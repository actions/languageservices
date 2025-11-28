# Using GitHub Actions Language Server in Neovim

## Prerequisites

- Node.js 18+
- Neovim 0.11+ with the new LSP config format

## Setup Options

### Option 1: Install from npm (Recommended)

Once published, you can install globally:

```bash
npm install -g @actions/languageserver
```

Then configure Neovim to use the installed binary:

```lua
-- ~/.config/nvim/lsp/actionsls.lua
return {
  cmd = { "actions-languageserver" },
  filetypes = { "yaml.ghaction" },  -- GitHub Actions workflow files only
  root_markers = { ".git" },
  init_options = {
    sessionToken = vim.fn.system("gh auth token"):gsub("%s+", ""),
    logLevel = "info",
  },
}
```

**Note:** This requires the package to be published to npm first.

### Option 2: Local Development Build

For development or if the npm package isn't published yet:

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
  filetypes = { "yaml.ghaction" },  -- GitHub Actions workflow files only
  root_markers = { ".git" },
  init_options = {
    sessionToken = vim.fn.system("gh auth token"):gsub("%s+", ""),
    logLevel = "info",
  },
}
```

**Important:** Replace `/absolute/path/to/languageservices` with your actual clone path.

## Filetype Detection for GitHub Actions Workflows

To ensure the LSP only runs on GitHub Actions workflow files (not all YAML files), set up filetype detection:

**Option A:** In `~/.config/nvim/init.lua`:

```lua
vim.api.nvim_create_autocmd({"BufRead", "BufNewFile"}, {
  pattern = ".github/workflows/*.{yml,yaml}",
  callback = function()
    vim.bo.filetype = "yaml.ghaction"
  end,
})
```

**Option B:** Create `~/.config/nvim/ftdetect/ghaction.vim`:

```vim
au BufRead,BufNewFile .github/workflows/*.yml,*.yaml setfiletype yaml.ghaction
```

This sets the filetype to `yaml.ghaction` for files in `.github/workflows/`, matching the `filetypes` setting in your LSP config.

### 4. Enable the LSP in your init.lua

Add to your Neovim configuration:

```lua
vim.lsp.enable('actionsls')
```

### 5. Restart Neovim

Open any `.github/workflows/*.yml` file. The filetype detection will set it to `yaml.ghaction`, and the language server will attach automatically.

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
