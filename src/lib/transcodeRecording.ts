export type TranscodeProgress = {
  ratio: number;
  message: string;
};

export type TranscodeResult = {
  file: File;
  usedFallback: boolean;
  failureStage?: 'load' | 'exec' | 'read';
};

type FfmpegInstance = {
  load: (config: {
    coreURL: string;
    wasmURL: string;
    classWorkerURL?: string;
  }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: 'progress', callback: (data: { progress: number }) => void) => void;
};

let ffmpegLoadPromise: Promise<FfmpegInstance | null> | null = null;

function resetFfmpegLoadCache(): void {
  ffmpegLoadPromise = null;
}

async function loadFfmpeg(): Promise<FfmpegInstance | null> {
  if (typeof window === 'undefined') return null;

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();
        const base = `${window.location.origin}/ffmpeg`;
        await ffmpeg.load({
          coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
          classWorkerURL: await toBlobURL(`${base}/worker.js`, 'text/javascript'),
        });
        return ffmpeg as unknown as FfmpegInstance;
      } catch (error) {
        resetFfmpegLoadCache();
        if (process.env.NODE_ENV === 'development') {
          console.warn('[transcodeRecording] ffmpeg.wasm failed to load', error);
        }
        return null;
      }
    })();
  }

  return ffmpegLoadPromise;
}

function webmInputName(file: File): string {
  return file.name.endsWith('.webm') ? file.name : 'input.webm';
}

async function runTranscodeExec(
  ffmpeg: FfmpegInstance,
  inputName: string,
  outputName: string,
  includeAudio: boolean
): Promise<void> {
  const args = [
    '-i',
    inputName,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
  ];

  if (includeAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-an');
  }

  args.push('-movflags', '+faststart', outputName);
  await ffmpeg.exec(args);
}

/**
 * Transcode a WebM recording to MP4 (H.264 + AAC) for broad desktop player support.
 * Falls back to the original file when WASM transcode is unavailable.
 */
export async function transcodeRecordingToMp4(
  webmFile: File,
  onProgress?: (progress: TranscodeProgress) => void
): Promise<TranscodeResult> {
  const ffmpeg = await loadFfmpeg();
  if (!ffmpeg) {
    return { file: webmFile, usedFallback: true, failureStage: 'load' };
  }

  const inputName = webmInputName(webmFile);
  const outputName = inputName.replace(/\.webm$/i, '.mp4');

  onProgress?.({ ratio: 0.05, message: 'Preparing video…' });

  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await ffmpeg.writeFile(inputName, await fetchFile(webmFile));

    ffmpeg.on('progress', ({ progress }) => {
      const ratio = Number.isFinite(progress) ? Math.min(0.95, Math.max(0.1, progress)) : 0.5;
      onProgress?.({ ratio, message: 'Preparing video…' });
    });

    try {
      await runTranscodeExec(ffmpeg, inputName, outputName, true);
    } catch {
      await runTranscodeExec(ffmpeg, inputName, outputName, false);
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

    onProgress?.({ ratio: 1, message: 'Video ready' });

    const mp4File = new File([bytes as BlobPart], outputName, { type: 'video/mp4' });
    return { file: mp4File, usedFallback: false };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[transcodeRecording] transcode failed', error);
    }
    return { file: webmFile, usedFallback: true, failureStage: 'exec' };
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function transcodeAudioToMp4(webmFile: File): Promise<File | null> {
  const ffmpeg = await loadFfmpeg();
  if (!ffmpeg) return null;

  const inputName = webmFile.name.endsWith('.webm') ? webmFile.name : 'input-audio.webm';
  const outputName = inputName.replace(/\.webm$/i, '.m4a');

  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await ffmpeg.writeFile(inputName, await fetchFile(webmFile));
    await ffmpeg.exec(['-i', inputName, '-c:a', 'aac', '-b:a', '192k', outputName]);
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    return new File([bytes as BlobPart], outputName, { type: 'audio/mp4' });
  } catch {
    return null;
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }
  }
}
