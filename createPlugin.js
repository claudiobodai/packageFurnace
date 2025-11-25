
/**
 * Create Umbraco 14+ / 17 Plugin (Vue 3 + Vite) — Production Ready Template
 * * AGGIORNAMENTI CRITICI:
 * - Estende UmbElementMixin (necessario per Context API)
 * - Implementa super.connectedCallback() (necessario per Auth)
 * - Usa Shadow DOM (isolamento stili)
 * - App.vue pre-configurato con umbHttpClient e Context consumption
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
   Scegli il tipo di estensione:
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
    <!-- Mock host per simulare il Web Component in dev mode -->
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
    fs.writeFileSync(path.join(projectRoot, 'index.html'), indexHtml);



    // ========== src/App.vue (Environment Ready) ==========
    // Questo è il template aggiornato con la struttura corretta
    const appVue = `<script setup lang="ts">
import { ref, onMounted } from "vue";
import { umbHttpClient } from "@umbraco-cms/backoffice/http-client";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";

// Prop fondamentale per accedere al Web Component Host
const props = defineProps<{
  mountElem: HTMLElement;
}>();

const host = ref<UmbLitElement>();
const loading = ref(false);
const token = ref<string | null>(null);

onMounted(async () => {
  // Recupero riferimento Host
  host.value = (props.mountElem.getRootNode() as any).host as UmbLitElement;

  if (!host.value) {
    console.warn("[${pluginName}] Host not found (Are you in Localhost?)");
    return;
  }
  
  // Esempio: Recupero Auth Token
  initAuth();
});

function initAuth() {
  if (!host.value) return;
  
  // Utilizzo corretto di consumeContext con callback
  host.value.consumeContext(UMB_AUTH_CONTEXT, (authContext) => {
    const t = authContext?.getLatestToken();
    if (t) {
      token.value = t;
      console.log("[${pluginName}] Authenticated!");
      // Qui puoi chiamare le tue API: loadData(t);
    }
  });
}

async function loadDataExample() {
  if (!host.value || !token.value) return;
  
  loading.value = true;
  try {
    const { data } = await tryExecute(
        host.value, 
        umbHttpClient.get({ 
            url: "/umbraco/management/api/v1/user/current",
            headers: { 'Authorization': \`Bearer \${token.value}\` }
        })
    );
    console.log("Current User:", data);
  } catch(e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="umb-plugin-box">
    <h3>${pluginName} <span class="badge">{{ token ? 'Auth OK' : 'No Auth' }}</span></h3>
    <p>Environment ready: Vue 3 + Vite + Umbraco Web Components.</p>
    
    <button @click="loadDataExample" :disabled="!token || loading">
      {{ loading ? 'Loading...' : 'Test API Call' }}
    </button>
  </div>
</template>

<style scoped>
.umb-plugin-box {
  padding: 1rem;
  background: #fff;
  border: 1px solid #e9e9eb;
  border-radius: 4px;
  font-family: 'Lato', sans-serif;
}
.badge {
  background: #2bc37c;
  color: white;
  font-size: 0.7em;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
}
button {
  background: #3544b1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 3px;
  cursor: pointer;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
`;
    fs.writeFileSync(path.join(projectRoot, 'src', 'App.vue'), appVue);


    // ========== Web Component Wrapper (.element.ts) ==========
    // IL CUORE DELLA FIX: UmbElementMixin + super.connectedCallback
    const elementClassName = `${classSafe}${pascalFromSlug(chosen.fileSuffix)}Element`;
    const elementTs = `import { createApp } from 'vue';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import App from './App.vue';

// Template per Shadow DOM
const template = document.createElement('template');
template.innerHTML = \`
  <style>
    :host { display: block; }
  </style>
  <div id="vue-root"></div>
\`;

export default class ${elementClassName} extends UmbElementMixin(HTMLElement) {
  #app;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot?.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();

    const mountElem = this.shadowRoot?.querySelector('#vue-root');
    
    if (mountElem && !this.#app) {
      // Passiamo 'this' (il Web Component Host) come prop a Vue
      // così App.vue può accedere a 'this.consumeContext'
      this.#app = createApp(App, { mountElem: this });
      this.#app.mount(mountElem);
    }
  }

  disconnectedCallback() {
    if (this.#app) {
      this.#app.unmount();
      this.#app = null;
    }
    super.disconnectedCallback();
  }
}

const tagName = '${customElementTag}';
if (!customElements.get(tagName)) {
  customElements.define(tagName, ${elementClassName});
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
        types: ["node"]
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

## Environment Features
- **UmbElementMixin**: Already implemented in wrapper.
- **Context API Ready**: \`super.connectedCallback\` logic included.
- **Vue Props**: Host element passed as \`mountElem\`.
- **HTTP Client**: configured in App.vue.

## Dev
\`\`\`bash
npm install
npm run dev        # dev server locale
npm run dev:watch  # build watch in App_Plugins (Recommended for Umbraco dev)
npm run build      # build produzione
\`\`\`
`;
    fs.writeFileSync(path.join(projectRoot, 'README.md'), readme);

    console.log('Project scaffold creato:', projectRoot);

    const doInstall = (await ask('\n Vuoi eseguire "npm install" ora? (s/N): '))
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
    console.log('║    Plugin "Environment Ready" Creato!                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`cd ${pluginName}`);
    if (!(doInstall === 's' || doInstall === 'si' || doInstall === 'y')) console.log('npm install');
    console.log('npm run dev:watch   → Per sviluppare dentro Umbraco (Consigliato)');
    
  } catch (err) {
    console.error('\nErrore:', err?.message || err);
    process.exit(1);
  }
})();