import 'server-only';
import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, invokeModelWithTools } from '@nucleas/ai-core/gateway';
import type { ToolCall, ToolDefinition } from '@nucleas/ai-contracts';
import { Types } from 'mongoose';
import { AiRunEvent } from '@/lib/models/AiControl';
import { executeIdeTool, type ToolArtifact } from '@/lib/ai/tools/executeTool';
import { ideChatToolDefinitions, type IdeToolProfile } from '@/lib/ai/tools/definitions';

const MAX_ROUNDS = 6;

export type ToolLoopResult = {
  content: string;
  toolCallsMade: string[];
  artifacts: ToolArtifact[];
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

type LoopMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export async function runIdeToolLoop(input: {
  gateway: GatewayConfiguration;
  messages: LoopMessage[];
  maxOutputTokens: number;
  includeImageTool: boolean;
  includeRepoTools?: boolean;
  toolProfile?: IdeToolProfile;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  runId: Types.ObjectId;
  signal?: AbortSignal;
}): Promise<ToolLoopResult> {
  const tools: ToolDefinition[] = ideChatToolDefinitions({
    includeImage: input.includeImageTool,
    includeRepo: input.includeRepoTools !== false,
    profile: input.toolProfile ?? 'full',
  });
  if (!tools.length) {
    throw new GatewayError('invalid_response', { kind: 'no_tools' });
  }
  const messages: LoopMessage[] = [...input.messages];
  const artifacts: ToolArtifact[] = [];
  const toolCallsMade: string[] = [];
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let latencyMs = 0;
  let sequence = 100;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (input.signal?.aborted) throw new GatewayError('cancelled');
    const result = await invokeModelWithTools(
      input.gateway,
      {
        role: 'architect',
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content ?? null,
          ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
          ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        })),
        maxOutputTokens: input.maxOutputTokens,
        tools,
      },
      { signal: input.signal }
    );
    latencyMs += result.latencyMs;
    if (result.inputTokens != null) inputTokens = (inputTokens ?? 0) + result.inputTokens;
    if (result.outputTokens != null) outputTokens = (outputTokens ?? 0) + result.outputTokens;

    if (!result.toolCalls.length) {
      return {
        content: result.content.trim().slice(0, 6000),
        toolCallsMade,
        artifacts,
        inputTokens,
        outputTokens,
        latencyMs,
      };
    }

    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    });

    for (const call of result.toolCalls) {
      toolCallsMade.push(call.function.name);
      sequence += 1;
      await AiRunEvent.create({
        organizationId: input.organizationId,
        projectId: input.projectId,
        runId: input.runId,
        sequence,
        type: 'tool.requested',
        summary: `Tool ${call.function.name}`.slice(0, 2000),
      }).catch(() => undefined);

      let toolContent: string;
      try {
        const executed = await executeIdeTool({
          name: call.function.name,
          argumentsJson: call.function.arguments,
          gateway: input.gateway,
          organizationId: input.organizationId,
          projectId: input.projectId,
          userId: input.userId,
          signal: input.signal,
        });
        artifacts.push(...executed.artifacts);
        toolContent = executed.content;
        sequence += 1;
        await AiRunEvent.create({
          organizationId: input.organizationId,
          projectId: input.projectId,
          runId: input.runId,
          sequence,
          type: 'tool.completed',
          summary: `Tool ${call.function.name} completed`.slice(0, 2000),
        }).catch(() => undefined);
      } catch (error) {
        toolContent = JSON.stringify({
          error: error instanceof Error ? error.message.slice(0, 500) : 'Tool failed.',
        });
        sequence += 1;
        await AiRunEvent.create({
          organizationId: input.organizationId,
          projectId: input.projectId,
          runId: input.runId,
          sequence,
          type: 'tool.failed',
          summary: `Tool ${call.function.name} failed`.slice(0, 2000),
        }).catch(() => undefined);
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolContent.slice(0, 12000),
      });
    }
  }

  throw new GatewayError('invalid_response');
}
