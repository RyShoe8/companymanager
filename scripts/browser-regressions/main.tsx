import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import AiTeamWorkspace from '../../src/components/ai/AiTeamWorkspace';
import AiTeamQueue from '../../src/components/ai/AiTeamQueue';
import RecordingSaveDialog from '../../src/components/shared/RecordingSaveDialog';
import ScreenshotSaveDialog from '../../src/components/shared/ScreenshotSaveDialog';
import EditableDate from '../../src/components/ui/EditableDate';
import EditableNumber from '../../src/components/ui/EditableNumber';
import EditableText from '../../src/components/ui/EditableText';
import '../../src/app/globals.css';

function Fixture() {
  const [surface, setSurface] = useState('workspace');
  const [dialog, setDialog] = useState('');
  const [savedMedia, setSavedMedia] = useState('');
  const [name, setName] = useState('Synthetic task');
  const [hours, setHours] = useState(3);
  const [date, setDate] = useState<Date | null>(new Date('2026-09-10T00:00:00Z'));
  return <><div className="bg-amber-100 p-3 text-center text-sm text-black">LOCAL TEST FIXTURE — synthetic data only; saves disappear when the fixture server stops.</div>
    <nav className="flex flex-wrap gap-4 p-4"><button onClick={() => setSurface('workspace')}>Workspace fixture</button><button onClick={() => setSurface('queue')}>Queue fixture</button>
      <button onClick={() => setDialog('recording')}>Recording save fixture</button><button onClick={() => setDialog('screenshot')}>Screenshot save fixture</button></nav>
    {surface === 'workspace' ? <AiTeamWorkspace /> : <AiTeamQueue />}
    <RecordingSaveDialog isOpen={dialog === 'recording'} defaultName="Synthetic recording" previewUrl={null} projects={[]}
      onSave={name => { setSavedMedia(name); setDialog(''); }} onDownload={setSavedMedia} onCancel={() => setDialog('')} />
    <ScreenshotSaveDialog isOpen={dialog === 'screenshot'} defaultName="Synthetic screenshot" previewUrl={null} projects={[]}
      onSave={name => { setSavedMedia(name); setDialog(''); }} onDownload={setSavedMedia} onCancel={() => setDialog('')} />
    <output>{savedMedia}</output>
    <section className="mx-auto max-w-4xl space-y-4 p-6"><h2>Inline editor regressions</h2>
      <div>Task name: <EditableText value={name} onSave={setName} /></div>
      <div>Hours: <EditableNumber value={hours} onSave={setHours} min={0} /></div>
      <div>Date: <EditableDate value={date} onSave={setDate} /></div>
      <output>{name} / {hours} hours / {date?.toISOString().slice(0, 10)}</output>
    </section></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
