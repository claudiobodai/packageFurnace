
/**
 * Create Umbraco 14+ / 17 Plugin (Vue 3 + Vite) — Web Components Ready
 *
 * - Web Components (export default class HTMLElement) per l'entry "element"
 * - Vue è incluso nel bundle (no external)
 * - Sostituzione process.env a build-time (evita ReferenceError)
 * - alias 'vue' -> 'vue/dist/vue.esm-bundler.js'
 * - umbraco-package.json usa "element" (niente js/css)
 * - Per Property Editor UI: chiede propertyEditorSchemaAlias
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toKebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
function toClassSafe(s) {
  const clean = s.replace(/[^A-Za-z0-9]/g, '');
  return /^[A-Za-z]/.test(clean) ? clean : 'X' + clean;
}
function pascalFromSlug(slug) {
  return slug.replace(/(^|-)([a-z])/g, (_, __, c) => (c ? c.toUpperCase() : ''));
}

(async () => {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║  Create Umbraco 14+/17 Plugin (Vue + Vite)            ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // ========== INPUT ==========
    const pluginName = (await ask('Nome plugin: ')).trim();
    const appPluginsPathInput = (await ask('Percorso assoluto di App_Plugins (senza trailing slash): ')).trim();

    console.log(`
📋 Scegli il tipo di estensione:
  1) Dashboard
  2) Property Editor
  3) Action Button (Entity Action)
  4) Section`);
    const type = (await ask('> ')).trim();

    if (!pluginName) { console.error('Nome plugin non valido. Abort.'); process.exit(1); }
    if (!appPluginsPathInput) { console.error('Percorso App_Plugins non valido. Abort.'); process.exit(1); }

    const kebab = toKebab(pluginName);
    const classSafe = toClassSafe(pluginName);

    const typeMap = {
      "1": { extType: "dashboard", alias: `${pluginName}.dashboard`, display: "Dashboard", fileSuffix: "dashboard" },
      "2": { extType: "propertyEditorUi", alias: `${pluginName}.propertyEditor`, display: "Property Editor", fileSuffix: "property-editor-ui" },
      "3": { extType: "entityAction", alias: `${pluginName}.actionButton`, display: "Action Button", fileSuffix: "entity-action" },
      "4": { extType: "section", alias: `${pluginName}.section`, display: "Section", fileSuffix: "section" }
    };
    const chosen = typeMap[type];
    if (!chosen) { console.error('Tipo non valido. Abort.'); process.exit(1); }

    let schemaAlias = "Umbraco.Plain.String";
    if (chosen.extType === "propertyEditorUi") {
      const ans = (await ask('propertyEditorSchemaAlias (default Umbraco.Plain.String): ')).trim();
      if (ans) schemaAlias = ans;
    }

    // ========== PERCORSI ==========
    const projectRoot = path.resolve(process.cwd(), pluginName);
    const targetAppPlugins = path.resolve(appPluginsPathInput);
    const outDir = path.join(targetAppPlugins, pluginName, 'dist');
    const elementFile = `src/${kebab}-${chosen.fileSuffix}.element.ts`; // entry build
    const customElementTag = `${kebab}-${chosen.fileSuffix}`;

    // ========== CARTELLE ==========
    console.log('\n🔨 Creazione struttura cartelle...');
    ensureDir(projectRoot);
    ensureDir(path.join(targetAppPlugins, pluginName));
    ensureDir(path.join(projectRoot, 'src'));
    ensureDir(path.join(projectRoot, 'public'));

    // ========== package.json ==========
    const pkg = {
      name: pluginName,
      version: "1.0.0",
      description: `Umbraco App_Plugin: ${pluginName}`,
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        "dev:watch": "vite build --watch",
        build: "vite build"
      },
      dependencies: {
        vue: "^3.5.0"
      },
      devDependencies: {
        vite: "^5.0.0",
        "@vitejs/plugin-vue": "^5.0.0",
        "@types/node": "^20.0.0",
        "@umbraco-cms/backoffice": "^17.0.0-rc1"
      }
    };
    fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify(pkg, null, 2));

    // ========== vite.config.ts ==========
    const viteConfig = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  define: {
    // sostituzioni a compile-time per evitare ReferenceError nel browser
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env': {},
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  },
  resolve: {
    alias: {
      // garantisce il bundler build di Vue (ESM) per le dipendenze
      vue: 'vue/dist/vue.esm-bundler.js'
    }
  },
  build: {
    target: 'es2022',
    outDir: ${JSON.stringify(outDir.replace(/\\/g, '\\\\'))},
    emptyOutDir: true,
    lib: {
      // 👉 deve puntare alla Web Component
      entry: path.resolve(__dirname, '${elementFile}'),
      name: '${pluginName}',
      fileName: '${pluginName}',
      formats: ['es']
    },
    rollupOptions: {
      // Vue nel bundle
      external: [],
      output: {
        assetFileNames: '${pluginName}.[ext]'
      }
    }
  },
  base: './',
  server: { port: 3000, open: true }
});
`;
    fs.writeFileSync(path.join(projectRoot, 'vite.config.ts'), viteConfig);

    // ========== index.html (dev) ==========
    const indexHtml = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pluginName} - ${chosen.display}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
    fs.writeFileSync(path.join(projectRoot, 'index.html'), indexHtml);

    // ========== src/main.ts ==========
    const mainTs = `import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

createApp(App).mount('#app');
`;
    fs.writeFileSync(path.join(projectRoot, 'src', 'main.ts'), mainTs);

    // ========== src/App.vue ==========
    const appVue = `<template>
  <div class="plugin-container">
    <div class="plugin-header">
      <h2>{{ title }}</h2>
      <span class="plugin-badge">{{ type }}</span>
    </div>
    <div class="plugin-content">
      <p class="status"> Vue + Web Component pronto!</p>
      <div class="counter-demo">
        <h3>Demo Counter:</h3>
        <button @click="count++">Count: {{ count }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const title = '${pluginName}';
const type = '${chosen.display}';
const count = ref(0);
</script>

<style scoped>
.plugin-container { padding: 24px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
.plugin-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
.plugin-header h2 { margin: 0; color: #1b264f; font-size: 28px; }
.plugin-badge { background: #3544b1; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.status { font-size: 18px; color: #059669; font-weight: 500; margin: 0 0 16px 0; }
.counter-demo { background: white; border: 2px solid #e5e7eb; padding: 20px; border-radius: 8px; }
.counter-demo button { background: #3544b1; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 16px; cursor: pointer; }
.counter-demo button:hover { background: #2c3a8f; }
</style>
`;
    fs.writeFileSync(path.join(projectRoot, 'src', 'App.vue'), appVue);

    // ========== src/styles.css ==========
    const stylesCss = `*{box-sizing:border-box}body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}#app{width:100%;min-height:100vh}`;
    fs.writeFileSync(path.join(projectRoot, 'src', 'styles.css'), stylesCss);

    // ========== Web Component wrapper (entry) ==========
    const elementClassName = `${classSafe}${pascalFromSlug(chosen.fileSuffix)}Element`;
    const elementTs = `import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

export default class ${elementClassName} extends HTMLElement {
  #app;
  connectedCallback() {
    if (!this.#app) {
      const root = document.createElement('div');
      this.appendChild(root);
      this.#app = createApp(App, {});
      this.#app.mount(root);
    }
  }
  disconnectedCallback() {
    if (this.#app) {
      this.#app.unmount();
      this.#app = null;
      this.innerHTML = '';
    }
  }
}

if (!customElements.get('${customElementTag}')) {
  customElements.define('${customElementTag}', ${elementClassName});
}
`;
    fs.writeFileSync(path.join(projectRoot, elementFile), elementTs);

    // ========== umbraco-package.json ==========
    const elementPath = `/App_Plugins/${pluginName}/dist/${pluginName}.js`;
    const umbracoExtensions = [];

    if (chosen.extType === 'propertyEditorUi') {
      umbracoExtensions.push({
        type: chosen.extType,
        alias: chosen.alias,
        name: chosen.display,
        element: elementPath,
        meta: {
          label: chosen.display,
          icon: "icon-wand",
          group: "common",
          propertyEditorSchemaAlias: schemaAlias
        }
      });
    } else if (chosen.extType === 'dashboard') {
      umbracoExtensions.push({
        type: chosen.extType,
        alias: chosen.alias,
        name: chosen.display,
        element: elementPath,
        meta: {
          label: chosen.display,
          pathname: kebab
        },
        weight: -10
      });
    } else if (chosen.extType === 'section') {
      umbracoExtensions.push({
        type: chosen.extType,
        alias: chosen.alias,
        name: chosen.display,
        element: elementPath,
        meta: {
          label: chosen.display,
          pathname: kebab
        }
      });
    } else if (chosen.extType === 'entityAction') {
      umbracoExtensions.push({
        type: chosen.extType,
        alias: chosen.alias,
        name: chosen.display,
        element: elementPath,
        meta: {
          label: chosen.display,
          icon: "icon-wand",
          entityTypes: ["document"] 
        }
      });
    }

    const umbracoPkg = {
      "$schema": "../../umbraco-package-schema.json",
      id: pluginName,
      name: pluginName,
      version: "1.0.0",
      extensions: umbracoExtensions
    };
    fs.writeFileSync(
      path.join(targetAppPlugins, pluginName, 'umbraco-package.json'),
      JSON.stringify(umbracoPkg, null, 2)
    );

    // ========== tsconfig.json ==========
    const tsconfig = {
      compilerOptions: {
        target: "ESNext",
        useDefineForClassFields: true,
        module: "ESNext",
        moduleResolution: "Node",
        strict: true,
        jsx: "preserve",
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        lib: ["ESNext", "DOM"],
        skipLibCheck: true,
        noEmit: true,
        types: ["vite/client", "@umbraco-cms/backoffice/extension-types"]
      },
      include: ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
      references: [{ path: "./tsconfig.node.json" }]
    };
    fs.writeFileSync(path.join(projectRoot, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // ========== tsconfig.node.json ==========
    const tsconfigNode = {
      compilerOptions: {
        composite: true,
        module: "ESNext",
        moduleResolution: "Node",
        allowSyntheticDefaultImports: true,
      },
      include: ["vite.config.ts"]
    };
    fs.writeFileSync(path.join(projectRoot, 'tsconfig.node.json'), JSON.stringify(tsconfigNode, null, 2));

    // ========== .gitignore & README ==========
    const gitignore = `node_modules/
dist/
.vscode/
.idea/
.DS_Store
Thumbs.db
*.log
.env
.env.local
`;
    fs.writeFileSync(path.join(projectRoot, '.gitignore'), gitignore);

    const readme = `# ${pluginName}

${chosen.display} per Umbraco 14+/17 (Vue 3 + Vite + Web Components)

## Dev
\`\`\`bash
npm install
npm run dev        # dev server locale su index.html
npm run dev:watch  # build watch in App_Plugins
npm run build      # build produzione
\`\`\`

## Build output
- JS: \`${elementPath}\` (entry: \`${elementFile}\`)
- Vue è **incluso** nel bundle.
- process.env viene sostituito a build-time (niente errori nel browser).

## Umbraco
- Manifest creato in \`App_Plugins/${pluginName}/umbraco-package.json\`
- \`element\` punta al file ESM generato
${chosen.extType === 'propertyEditorUi' ? `- \`meta.propertyEditorSchemaAlias = "${schemaAlias}"\`` : ''}
`;
    fs.writeFileSync(path.join(projectRoot, 'README.md'), readme);

    console.log('Project scaffold creato:', projectRoot);

    const doInstall = (await ask('\nVuoi eseguire "npm install" ora? (s/N): '))
      .trim().toLowerCase();
    if (doInstall === 's' || doInstall === 'si' || doInstall === 'y') {
      console.log('\nEseguo npm install...');
      try {
        execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
        console.log('npm install completato.');
      } catch {
        console.error('Errore durante npm install. Eseguilo manualmente.');
      }
    } else {
      console.log('\n⏭Installazione saltata.');
    }

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║        Plugin creato con successo!                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`cd ${pluginName}`);
    if (!(doInstall === 's' || doInstall === 'si' || doInstall === 'y')) console.log('npm install');
    console.log('npm run dev         → Dev server (index.html, sviluppo UI)');
    console.log('npm run dev:watch   → Build continua in App_Plugins');
    console.log('npm run build       → Build produzione\n');
    console.log('Output build:', outDir);
    console.log('Tipo:', chosen.display);
    console.log('Alias:', chosen.alias);
    if (chosen.extType === 'propertyEditorUi') console.log('propertyEditorSchemaAlias:', schemaAlias);
    console.log('\nSe non vedi subito l’estensione, riavvia l’app o svuota cache app.');
  } catch (err) {
    console.error('\nErrore:', err?.message || err);
    process.exit(1);
  }
})();
