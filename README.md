# payhumans-mcp

[![smithery badge](https://smithery.ai/badge/payhumans-mcp)](https://smithery.ai/server/payhumans-mcp)
[![npm version](https://img.shields.io/npm/v/payhumans-mcp.svg)](https://www.npmjs.com/package/payhumans-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

MCP (Model Context Protocol) server for the **[Pay Humans](https://payhumans.io)** platform. Lets AI agents natively discover and hire human experts for tasks they can't do themselves -- research, verification, physical delivery, expert calls, and more.

## Tools

| Tool | Description |
|------|-------------|
| `search_experts` | Find human experts by domain, research type, or max rate |
| `post_job` | Post a new job for a human expert to complete |
| `get_job` | Fetch job status and results |
| `list_jobs` | List your agent's jobs (optional status filter) |
| `complete_job` | Accept expert's work and trigger payout |
| `send_message` | Send a message to the assigned expert |
| `get_expert` | Get an expert's full profile, availability, and rating |

## Install

### Via Smithery (Recommended)

Install automatically via [Smithery](https://smithery.ai/server/payhumans-mcp):

```bash
npx -y @smithery/cli install payhumans-mcp --client claude
```

### Via npx

```bash
npx -y payhumans-mcp
```

### Manual Install

```bash
npm install -g payhumans-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_API_KEY` | Yes | Your Pay Humans API key (starts with `ph_`) |
| `API_BASE_URL` | No | API endpoint (default: `https://api.payhumans.io`) |

Get your API key at [payhumans.io](https://payhumans.io).

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payhumans": {
      "command": "npx",
      "args": ["-y", "payhumans-mcp"],
      "env": {
        "AGENT_API_KEY": "ph_your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add payhumans -- npx -y payhumans-mcp
```

Then set your API key:

```bash
export AGENT_API_KEY=ph_your_key_here
```

## Example Usage

Once connected, your AI agent can:

> "Search for healthcare experts on Pay Humans"

> "Post a job to find someone who can verify a business address in San Francisco, budget $50"

> "Check the status of my job"

> "Find an expert in FDA regulations for an expert call, max $100/hr"

## How It Works

```
AI Agent (Claude, GPT-4, etc.)
    |
    v
payhumans-mcp (this server)
    |
    v
Pay Humans API
    |
    v
Human Expert completes the task
    |
    v
Result returned to AI Agent
```

1. **Agent posts a job** via `post_job` with title, description, domain, budget
2. **Platform matches** the job to qualified human experts
3. **Expert completes** the work and submits results
4. **Agent reviews** via `get_job` and accepts via `complete_job`
5. **Expert gets paid** automatically

## Development

```bash
git clone https://github.com/Prithvi100/payhumans-mcp.git
cd payhumans-mcp
npm install
npm run dev
```

## License

MIT
