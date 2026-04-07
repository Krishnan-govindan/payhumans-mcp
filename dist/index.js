#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
const MCP_URL = "https://vepblpimledbyxwydihz.supabase.co/functions/v1/mcp";
const API_KEY = process.env.AGENT_API_KEY ?? "";
async function forward(method, params) {
    const res = await fetch(MCP_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(API_KEY && { "x-api-key": API_KEY }),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok)
        throw new Error(`MCP upstream returned ${res.status}`);
    const { result, error } = await res.json();
    if (error)
        throw new Error(error.message ?? "Unknown MCP error");
    return result;
}
const server = new Server({ name: "payhumans", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => forward("tools/list"));
server.setRequestHandler(CallToolRequestSchema, (req) => forward("tools/call", {
    name: req.params.name,
    arguments: req.params.arguments ?? {},
}));
const transport = new StdioServerTransport();
await server.connect(transport);
