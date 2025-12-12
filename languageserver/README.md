# actions/languageserver

`actions-languageserver` hosts the `actions-languageservice` and makes it available via the [language server protocol](https://microsoft.github.io/language-server-protocol/) (LSP) as a standalone language server.

## Installation

The [package](https://www.npmjs.com/package/@actions/languageserver) contains TypeScript types and compiled ECMAScript modules.

```bash
npm install @actions/languageserver
```

To install the language server as a standalone CLI:

```bash
npm install -g @actions/languageserver
```

This makes the `actions-languageserver` command available globally.

## Usage

### Standalone CLI

After installing globally, you can run the language server directly:

```bash
actions-languageserver --stdio
```

This starts the language server using stdio transport, which is the standard way for editors to communicate with language servers.

### In Neovim

Neovim 0.5+ has built-in LSP support. To use the Actions language server:

#### 1. Install the language server

```bash
npm install -g @actions/languageserver
```

#### 2. Set up filetype detection

Add this to your `init.lua` to detect GitHub Actions workflow files:

```lua
vim.filetype.add({
  pattern = {
    [".*/%.github/workflows/.*%.ya?ml"] = "yaml.ghactions",
  },
})
```

This sets the filetype to `yaml.ghactions` for YAML files in `.github/workflows/`, allowing you to keep separate YAML LSP configurations if needed.

#### 3. Create the LSP configuration

Create `~/.config/nvim/lsp/actionsls.lua`:

```lua
local function get_github_token()
  local handle = io.popen("gh auth token 2>/dev/null")
  if not handle then return nil end
  local token = handle: read("*a"):gsub("%s+", "")
  handle:close()
  return token ~= "" and token or nil
end

local function parse_github_remote(url)
  if not url or url == "" then return nil end

  -- SSH format: git@github.com:owner/repo.git
  local owner, repo = url:match("git@github%.com:([^/]+)/([^/%.]+)")
  if owner and repo then
    return owner, repo: gsub("%.git$", "")
  end

  -- HTTPS format: https://github.com/owner/repo.git
  owner, repo = url:match("github%.com/([^/]+)/([^/%.]+)")
  if owner and repo then
    return owner, repo:gsub("%.git$", "")
  end

  return nil
end

local function get_repo_info(owner, repo)
  local cmd = string.format(
    "gh repo view %s/%s --json id,owner --template '{{.id}}\t{{.owner.type}}' 2>/dev/null",
    owner,
    repo
  )
  local handle = io.popen(cmd)
  if not handle then return nil end
  local result = handle: read("*a"):gsub("%s+$", "")
  handle:close()

  local id, owner_type = result:match("^(%d+)\t(.+)$")
  if id then
    return {
      id = tonumber(id),
      organizationOwned = owner_type == "Organization",
    }
  end
  return nil
end

local function get_repos_config()
  local handle = io.popen("git rev-parse --show-toplevel 2>/dev/null")
  if not handle then return nil end
  local git_root = handle: read("*a"):gsub("%s+", "")
  handle:close()

  if git_root == "" then return nil end

  handle = io.popen("git remote get-url origin 2>/dev/null")
  if not handle then return nil end
  local remote_url = handle:read("*a"):gsub("%s+", "")
  handle:close()

  local owner, name = parse_github_remote(remote_url)
  if not owner or not name then return nil end

  local info = get_repo_info(owner, name)

  return {
    {
      id = info and info.id or 0,
      owner = owner,
      name = name,
      organizationOwned = info and info.organizationOwned or false,
      workspaceUri = "file://" .. git_root,
    },
  }
end

return {
  cmd = { "actions-languageserver", "--stdio" },
  filetypes = { "yaml.ghactions" },
  root_markers = { ".git" },
  init_options = {
    -- Optional: provide a GitHub token and repo context for added functionality
    -- (e.g., repository-specific completions)
    sessionToken = get_github_token(),
    repos = get_repos_config(),
  },
}
```

#### 4. Enable the LSP

Add to your `init.lua`:

```lua
vim.lsp.enable('actionsls')
```

#### 5. Verify it's working

Open any `.github/workflows/*.yml` file and run:

```vim
:checkhealth vim.lsp
```

You should see `actionsls` in the list of attached clients.

### Basic usage using `vscode-languageserver-node`

For the server, import the module. It detects whether it's running in a Node.js environment or a web worker and initializes the appropriate connection.

`server.ts`:

```typescript
import "@actions/languageserver";
```

For the client, create a new `LanguageClient` pointing to the server module.

`client.ts`:

```typescript
import {LanguageClient, ServerOptions, TransportKind} from "vscode-languageclient/node";

const debugOptions = {execArgv: ["--nolazy", "--inspect=6010"]};

const clientOptions: LanguageClientOptions = {
  documentSelector: [{
    pattern: "**/.github/workflows/*.{yaml,yml}"
  }]
};

const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
const serverOptions: ServerOptions = {
  run: {module: serverModule, transport: TransportKind.ipc},
  debug: {
    module: serverModule,
    transport: TransportKind.ipc,
    options: debugOptions
  }
};

const client = new LanguageClient("actions-language", "GitHub Actions Language Server", serverOptions, clientOptions);
```

### From a web worker

See [../browser-playground](../browser-playground) for an example implementation that hosts the language server in a web worker.

### Providing advanced functionality

The language server accepts initialization options that can be used to configure additional functionality. If you pass in a github.com `sessionToken`, the language service will use data from github.com to perform additional validations and provide additional auto-completion suggestions.

```typescript
export interface InitializationOptions {
  /**
   * GitHub token that will be used to retrieve additional information from github.com
   *
   * Requires the `repo` and `workflow` scopes
   */
  sessionToken?: string;

  /**
   * List of repositories that the language server should be aware of
   */
  repos?: RepositoryContext[];

  /**
   * Desired log level
   */
  logLevel?: LogLevel;
}
```

pass the `initializationOptions` to the `LanguageClient` when establishing the connection:

```typescript
const clientOptions: LanguageClientOptions = {
  documentSelector: [{
    pattern: "**/.github/workflows/*.{yaml,yml}"
  }],
  initializationOptions: initializationOptions
};

const client = new LanguageClient("actions-language", "GitHub Actions Language Server", serverOptions, clientOptions);
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) at the root of the repository for general guidelines and recommendations.

If you do want to contribute, please run [prettier](https://prettier.io/) to format your code and add unit tests as appropriate before submitting your PR.

### Build

```bash
npm run build
```

or to watch for changes

```bash
npm run watch
```

### Running the language server locally

After running

```bash
npm run build:cli
npm link
```

`actions-languageserver` will be available globally. You can start it with:

```bash
actions-languageserver --stdio
```

Once linked you can also watch for changes and rebuild automatically:

```bash
npm run watch:cli
```

### Test

```bash
npm test
```

or to watch for changes and run tests:

```bash
npm run test-watch
```

### Lint

```bash
npm run format-check
```

## License

This project is licensed under the terms of the MIT open source license. Please refer to [MIT](../LICENSE) for the full terms.

