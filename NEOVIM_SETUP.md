# Using GitHub Actions Language Server in Neovim

## Prerequisites

- Node.js 18+
- Neovim 0.11+ with the new LSP config format

## Setup

### 1. Clone and build

```bash
git clone https://github.com/actions/languageservices.git
cd languageservices
npm install
npm run build --workspaces --if-present
```

### 2. Bundle the server

The server needs to be bundled into a single file to avoid ESM module resolution issues:

```bash
cd languageserver
npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --outfile=dist/server-bundled.cjs \
  --external:vscode \
  --loader:.json=json
```

This creates `dist/server-bundled.cjs` (~5.6MB) that contains the entire server.

### 3. Configure Neovim

Create `~/.config/nvim/lsp/actionsls.lua`:

```lua
return {
  cmd = {
    "/absolute/path/to/languageservices/languageserver/bin/actions-languageserver",
  },
  filetypes = { "yaml" },
  root_markers = { ".git" },
  init_options = {
    sessionToken = os.getenv("GITHUB_SESSION_TOKEN") or "",
    logLevel = "info",
  },
}
```

**Important:** Replace `/absolute/path/to/languageservices` with your actual clone path.

### 4. Enable the LSP in your init.lua

Add to your Neovim configuration:

```lua
vim.lsp.enable('actionsls')
```

### 5. Restart Neovim

Open any `.github/workflows/*.yml` file and the language server should attach automatically.

## Files Created

- `languageserver/dist/server-bundled.cjs` - Bundled server (~5.6MB)
- `languageserver/bin/actions-languageserver` - Shell wrapper script

The `dist/` directory is gitignored; you'll need to rebuild after pulling updates.

## Troubleshooting

Check if the server is running:

```vim
:lua =vim.lsp.get_clients()
```

View LSP logs:

```bash
tail -f ~/.local/state/nvim/lsp.log
```

Manually start the server to test:

```vim
:lua vim.lsp.start({name='actionsls', cmd={'/path/to/bin/actions-languageserver'}, root_dir=vim.fn.getcwd(), init_options={sessionToken='', logLevel='info'}})
```

## Notes

- The main code change is in `languageserver/src/index.ts` to use dynamic imports, avoiding loading browser modules in Node.js
- The bundling step is necessary because TypeScript outputs ESM with bare imports that Node.js can't resolve
- Only workflow files in git repositories will activate the LSP (due to `root_markers = { ".git" }`)
