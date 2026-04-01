#!/usr/bin/env node
/**
 * agent-network MCP Server
 *
 * Exposes 7 tools so AI agents (Claude, GPT-4, etc.) can natively
 * discover and hire human experts via the Pay Humans platform.
 *
 * Auth: reads AGENT_API_KEY + API_BASE_URL from environment
 * Transport: StdioServerTransport (works with Claude Desktop + Claude Code)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
const AGENT_API_KEY = process.env.AGENT_API_KEY ?? "";

if (!AGENT_API_KEY) {
  console.error("Warning: AGENT_API_KEY not set. API calls will be unauthenticated.");
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (AGENT_API_KEY) {
    headers["X-API-Key"] = AGENT_API_KEY;
  }
  const response = await fetch(url, { ...options, headers });
  const data = await response.json() as unknown;
  if (!response.ok) {
    const err = (data as { error?: string })?.error ?? `HTTP ${response.status}`;
    throw new Error(err);
  }
  return data;
}

// ——— Tool schemas ———

const SearchExpertsSchema = z.object({
  domain: z.string().optional().describe("Filter by domain (e.g. healthcare, fintech)"),
  researchType: z.string().optional().describe("Filter by research type (e.g. expert_call, desk_research)"),
  maxRateCents: z.number().int().positive().optional().describe("Maximum expert rate in cents"),
});

const PostJobSchema = z.object({
  title: z.string().describe("Short title for the job"),
  description: z.string().describe("Full instructions for the expert"),
  domains: z.array(z.string()).describe("Domain tags to match experts (e.g. [\"healthcare\"])"),
  researchType: z.string().describe("Type of research: expert_call | desk_research | survey | other"),
  budgetCents: z.number().int().positive().describe("Maximum budget in cents (e.g. 5000 = $50)"),
  deadline: z.string().optional().describe("ISO 8601 deadline (optional)"),
});

const GetJobSchema = z.object({
  jobId: z.string().uuid().describe("The job UUID"),
});

const ListJobsSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "submitted", "completed", "cancelled"]).optional()
    .describe("Filter by job status"),
});

const CompleteJobSchema = z.object({
  jobId: z.string().uuid().describe("The job UUID to mark as completed"),
});

const SendMessageSchema = z.object({
  jobId: z.string().uuid().describe("The job UUID"),
  content: z.string().describe("Message content to send to the expert"),
});

const GetExpertSchema = z.object({
  expertId: z.string().uuid().describe("The expert UUID"),
});

// ——— MCP Server ———

const server = new Server(
  { name: "agent-network", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_experts",
      description: "Search for human experts on the Pay Humans platform by domain, research type, or rate. Returns a list of matching experts with their profiles.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Filter by domain (e.g. healthcare, fintech, law)" },
          researchType: { type: "string", description: "Filter by research type (e.g. expert_call, desk_research, survey)" },
          maxRateCents: { type: "number", description: "Maximum expert hourly/task rate in cents" },
        },
      },
    },
    {
      name: "post_job",
      description: "Post a new research job to the Pay Humans platform. AI agents use this to hire human experts for research tasks, expert calls, and analysis.",
      inputSchema: {
        type: "object",
        required: ["title", "description", "domains", "researchType", "budgetCents"],
        properties: {
          title: { type: "string", description: "Short descriptive title for the job" },
          description: { type: "string", description: "Full instructions and requirements for the expert" },
          domains: { type: "array", items: { type: "string" }, description: "Domain tags to match experts" },
          researchType: { type: "string", description: "Type: expert_call | desk_research | survey | other" },
          budgetCents: { type: "number", description: "Maximum budget in cents (5000 = $50)" },
          deadline: { type: "string", description: "Optional ISO 8601 deadline" },
        },
      },
    },
    {
      name: "get_job",
      description: "Fetch the current status and result of a job by its ID. Use this to check if an expert has submitted their work.",
      inputSchema: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", description: "The job UUID" },
        },
      },
    },
    {
      name: "list_jobs",
      description: "List your (the agent's) jobs. Optionally filter by status to see open, in-progress, or completed jobs.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "assigned", "in_progress", "submitted", "completed", "cancelled"],
            description: "Optional status filter",
          },
        },
      },
    },
    {
      name: "complete_job",
      description: "Mark a submitted job as completed, accepting the expert's work. This triggers the payout to the expert.",
      inputSchema: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", description: "The job UUID to complete" },
        },
      },
    },
    {
      name: "send_message",
      description: "Send a message to the expert assigned to a job. Use this for clarifications, follow-up questions, or feedback.",
      inputSchema: {
        type: "object",
        required: ["jobId", "content"],
        properties: {
          jobId: { type: "string", description: "The job UUID" },
          content: { type: "string", description: "Your message to the expert" },
        },
      },
    },
    {
      name: "get_expert",
      description: "Fetch a human expert's full profile including their domains, research types, rate, availability, and average rating.",
      inputSchema: {
        type: "object",
        required: ["expertId"],
        properties: {
          expertId: { type: "string", description: "The expert UUID" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_experts": {
        const params = SearchExpertsSchema.parse(args);
        const qs = new URLSearchParams();
        if (params.domain) qs.set("domain", params.domain);
        const queryStr = qs.toString();
        const data = await apiFetch(`/experts${queryStr ? `?${queryStr}` : ""}`) as { experts: unknown[] };
        let experts = data.experts ?? [];
        if (params.researchType) {
          experts = (experts as Array<{ researchTypes?: string[] }>).filter((e) =>
            e.researchTypes?.includes(params.researchType!)
          );
        }
        if (params.maxRateCents != null) {
          experts = (experts as Array<{ rateCents?: number }>).filter(
            (e) => (e.rateCents ?? Infinity) <= params.maxRateCents!
          );
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ experts, count: experts.length }, null, 2) }],
        };
      }

      case "post_job": {
        const body = PostJobSchema.parse(args);
        const job = await apiFetch("/jobs", {
          method: "POST",
          body: JSON.stringify(body),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
        };
      }

      case "get_job": {
        const { jobId } = GetJobSchema.parse(args);
        const job = await apiFetch(`/jobs/${jobId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
        };
      }

      case "list_jobs": {
        const params = ListJobsSchema.parse(args);
        const qs = new URLSearchParams();
        if (params.status) qs.set("status", params.status);
        const data = await apiFetch(`/jobs${qs.toString() ? `?${qs}` : ""}`) as { jobs: unknown[] };
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "complete_job": {
        const { jobId } = CompleteJobSchema.parse(args);
        const result = await apiFetch(`/jobs/${jobId}/complete`, { method: "POST" });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "send_message": {
        const { jobId, content } = SendMessageSchema.parse(args);
        const result = await apiFetch(`/jobs/${jobId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_expert": {
        const { expertId } = GetExpertSchema.parse(args);
        const expert = await apiFetch(`/experts/${expertId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(expert, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("agent-network MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
