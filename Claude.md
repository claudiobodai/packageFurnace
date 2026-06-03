# 📚 Guida Completa: Property Editors Umbraco 17 con Vue 3

## Ricerca Approfondita - Documentazione Ufficiale & Community

Questa guida è basata su:
- 📖 Documentazione ufficiale Umbraco CMS
- 💬 Forum Umbraco (casi reali di migrazione)
- 🔧 Best practices dalla community
- ✅ Casi di successo documentati

---

## ✅ SCOPERTE CRITICHE dalla Ricerca

### 1. **getValue() è OBBLIGATORIO** (Da Forum Umbraco)

**Problema scoperto da un utente reale:**
> "The UI works fine, and I can edit the values in my Vue app... However, when I click 'Save' in the backoffice, the data is **not persisted** to the database."

**Soluzione da Sebastiaan Janssen (Umbraco HQ):**
```typescript
// ❌ INCOMPLETO - Non basta get/set value
get value() {
  return this.#value;
}

set value(newValue: any) {
  this.#value = newValue;
}

// ✅ NECESSARIO - Umbraco chiama questo prima del save
getValue(): any {
  return this.#value;
}
```

**Perché è necessario:**
- Umbraco chiama `getValue()` prima di salvare
- Il getter `value` da solo NON è sufficiente
- Senza `getValue()`, il payload è vuoto

---

### 2. **Event 'change' non 'property-value-change'** (Da Niels Lyngsø - Umbraco Team)

**Correzione ufficiale da Niels Lyngsø:**
> "Also, note that we support just 'change' as the event name. The 'property-value-change' was only used in the early days of the project."

```typescript
// ❌ DEPRECATO
this.dispatchEvent(new CustomEvent('property-value-change', {
  bubbles: true,
  composed: true,
  detail: { value: newValue }
}));

// ✅ CORRETTO (via UmbChangeEvent)
import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';

this.value = newValue;
this.dispatchEvent(new UmbChangeEvent());

// ✅ ALTERNATIVA (senza detail, no bubbles/composed)
this.dispatchEvent(new CustomEvent('change'));
```

**Regole per gli eventi:**
- ❌ Non usare `bubbles: true` o `composed: true` (problemi nei Block Editors)
- ❌ Non passare `detail: { value }` (il valore si legge da `.value`)
- ✅ Usa `UmbChangeEvent` (raccomandato)
- ✅ Oppure `CustomEvent('change')` semplice

---

### 3. **structuredClone() invece di JSON.parse/stringify**

**Da utente che ha risolto:**
> "structuredClone() worked perfectly - I went with your second suggestion and it's much cleaner than JSON.parse/stringify."

```typescript
// ❌ VECCHIO METODO
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ✅ MODERNO (ES2021)
function deepClone<T>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch (e) {
    // Fallback per browser vecchi
    return JSON.parse(JSON.stringify(obj));
  }
}
```

**Perché usarlo:**
- Gestisce Date, Map, Set, RegExp
- Più veloce di JSON.parse/stringify
- Supportato in tutti i browser moderni
- Fallback incluso per compatibilità

---

### 4. **Frozen Objects in Umbraco** (Scoperta Community)

**Problema segnalato:**
> "I think that Umbraco passes frozen objects to the setter, so I had to clone in the setter too before modifying"

```typescript
// ❌ ERRORE: Cannot add property, object is not extensible
set value(newValue: ModelValue) {
  this.#value = newValue;
  this.#value.newProperty = 'test'; // 💥 Error!
}

// ✅ SOLUZIONE: Clone in setter
set value(newValue: ModelValue) {
  this.#value = structuredClone(newValue);
  // Ora puoi modificarlo liberamente
}
```

**Perché succede:**
- Umbraco "freezes" gli oggetti per sicurezza
- Impedisce modifiche accidentali
- SEMPRE clonare se devi modificare

---

## 📋 Template COMPLETO e CORRETTO

### Web Component Element (TypeScript)

```typescript
import { createApp } from 'vue';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import type { UmbPropertyEditorUiElement } from '@umbraco-cms/backoffice/property-editor';
import App from './App.vue';

const template = document.createElement('template');
template.innerHTML = `
  <style>:host { display: block; }</style>
  <div id="app"></div>
`;

export default class MyPropertyEditorElement 
  extends UmbElementMixin(HTMLElement) 
  implements UmbPropertyEditorUiElement {
  
  #app: any;
  #value: any = {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot?.appendChild(template.content.cloneNode(true));
  }

  // 1️⃣ GETTER (per Umbraco lato read)
  get value() {
    return this.#value;
  }

  // 2️⃣ SETTER (riceve valori frozen da Umbraco)
  set value(newValue: any) {
    // IMPORTANTE: Clone perché Umbraco passa oggetti frozen
    this.#value = structuredClone(newValue);
  }

  // 3️⃣ getValue() - CRITICO per la persistenza!
  getValue(): any {
    return this.#value;
  }

  connectedCallback() {
    // ⚠️ SEMPRE chiamare super PRIMA
    super.connectedCallback();

    const mountElem = this.shadowRoot?.querySelector('#app');
    if (mountElem && !this.#app) {
      // ⚠️ Passa ENTRAMBE le props
      this.#app = createApp(App, {
        host: this,              // Per Context API
        initialValue: this.#value // Valore iniziale
      });
      this.#app.mount(mountElem);
    }
  }

  disconnectedCallback() {
    if (this.#app) {
      this.#app.unmount();
      this.#app = null;
    }
    super.disconnectedCallback?.();
  }
}

customElements.define('my-property-editor', MyPropertyEditorElement);
```

---

### App.vue (Vue 3 Component)

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { UmbChangeEvent } from "@umbraco-cms/backoffice/event";
import { umbHttpClient } from "@umbraco-cms/backoffice/http-client";
import { tryExecute } from "@umbraco-cms/backoffice/resources";

interface Props {
  host: any;
  initialValue?: string;
}

const props = defineProps<Props>();
const value = ref(props.initialValue || '');

// Flag per evitare loop
let isUpdating = false;

// Watch per cambiamenti
watch(value, () => {
  if (!isUpdating) {
    saveValue();
  }
});

function saveValue() {
  if (!props.host) return;

  isUpdating = true;
  try {
    // 1. Aggiorna valore
    props.host.value = value.value;
    
    // 2. Dispatch evento (NUOVO PATTERN)
    props.host.dispatchEvent(new UmbChangeEvent());
  } finally {
    // Reset flag dopo tick
    setTimeout(() => { isUpdating = false; }, 0);
  }
}

onMounted(() => {
  if (!props.host) return;

  // Esempio: Autenticazione e API call
  props.host.consumeContext(UMB_AUTH_CONTEXT, async (authContext: any) => {
    const token = await authContext?.getLatestToken();
    
    if (token) {
      // Carica dati con token
      const { data } = await tryExecute(
        props.host,
        umbHttpClient.get({
          url: "/your/api/endpoint",
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      // Usa i dati
      console.log(data);
    }
  });
});
</script>

<template>
  <div style="padding: var(--uui-size-space-4); font-family: var(--uui-font-family);">
    
    <!-- ✅ USA UUI COMPONENTS, NON HTML NATIVI -->
    <uui-select v-model="value" placeholder="Select...">
      <uui-select-option value="opt1">Option 1</uui-select-option>
      <uui-select-option value="opt2">Option 2</uui-select-option>
    </uui-select>

  </div>
</template>
```

---

## 🎯 Componenti UUI: Uso Corretto

### ❌ PROBLEMA: HTML Select non si stilizza

```vue
<!-- ❌ NON FUNZIONA IN SHADOW DOM -->
<select v-model="value" style="color: red;">
  <option>Value 1</option>
  <option>Value 2</option>
</select>
```

**Perché fallisce:**
- Gli elementi `<option>` nativi non accettano styling
- In Shadow DOM, gli stili sono ignorati completamente
- Impossibile personalizzare l'aspetto

---

### ✅ SOLUZIONE: UUI Select Component

```vue
<uui-select 
  v-model="selectedValue"
  @change="handleChange"
  placeholder="Select an option..."
>
  <uui-select-option value="value1">Label 1</uui-select-option>
  <uui-select-option value="value2">Label 2</uui-select-option>
  <uui-select-option value="value3">Label 3</uui-select-option>
</uui-select>
```

**Event Handling per uui-select:**
```typescript
function handleChange(event: Event) {
  // uui-select emette CustomEvent con detail
  const customEvent = event as CustomEvent;
  
  if (customEvent.detail?.value !== undefined) {
    selectedValue.value = customEvent.detail.value;
  }
}
```

---

## 🛠️ Vite Configuration Completa

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // ⚠️ CRITICO: Dichiara tag UUI come Web Components
          isCustomElement: (tag) => 
            tag.startsWith('uui-') || tag.startsWith('umb-')
        }
      }
    })
  ],
  
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env': {},
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  },
  
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js'
    }
  },
  
  build: {
    target: 'es2022',
    outDir: 'path/to/App_Plugins/YourPlugin/dist',
    emptyOutDir: true,
    
    lib: {
      entry: path.resolve(__dirname, 'src/your-element.element.ts'),
      name: 'YourPlugin',
      fileName: 'YourPlugin',
      formats: ['es']
    },
    
    rollupOptions: {
      // ⚠️ CRITICO: External per Umbraco packages
      external: [
        /^@umbraco-cms\/backoffice(\/.*)?$/,
        /^@umbraco-ui\/uui(\/.*)?$/,
      ],
      // Vue DEVE essere bundled (NON external)
      output: {
        assetFileNames: 'YourPlugin.[ext]'
      }
    }
  },
  
  base: './',
  server: { port: 3000, open: true }
});
```

---

## 📊 Componenti UUI Più Usati

### uui-input
```vue
<uui-input 
  v-model="textValue"
  type="text"
  placeholder="Enter text..."
  label="Field Label"
/>
```

### uui-button
```vue
<uui-button 
  look="primary"
  color="positive"
  @click="handleClick"
  :disabled="loading"
>
  Save Changes
</uui-button>
```

**Varianti:**
- `look`: `"primary"` | `"secondary"` | `"outline"` | `"placeholder"`
- `color`: `"default"` | `"positive"` | `"warning"` | `"danger"`

### uui-box
```vue
<uui-box headline="Section Title">
  <p>Content here...</p>
</uui-box>
```

### uui-checkbox
```vue
<uui-checkbox 
  v-model="checked"
  label="Accept terms"
/>
```

### uui-toggle
```vue
<uui-toggle 
  v-model="enabled"
  label="Enable feature"
/>
```

---

## 🔍 Debugging Checklist

Quando il tuo Property Editor non funziona:

### 1. Persistenza Dati
- [ ] `getValue()` implementato?
- [ ] `UmbChangeEvent` dispatched dopo `this.value = ...`?
- [ ] Clonato oggetti frozen con `structuredClone()`?

### 2. Web Component
- [ ] `super.connectedCallback()` chiamato per primo?
- [ ] Passi `host: this` a Vue?
- [ ] Passi `initialValue: this.value` a Vue?

### 3. Vue Component
- [ ] Props dichiarate correttamente (`host`, `initialValue`)?
- [ ] Flag `isUpdating` per evitare loop?
- [ ] Usi `props.host.value` per settare?
- [ ] Usi `props.host.dispatchEvent(new UmbChangeEvent())`?

### 4. Vite Config
- [ ] `isCustomElement` per `uui-*` e `umb-*`?
- [ ] Umbraco packages in `external`?
- [ ] Vue NON in external (deve essere bundled)?

### 5. UUI Components
- [ ] Usi `uui-select` invece di `<select>`?
- [ ] Eventi handled con `CustomEvent.detail.value`?

---

## 🚀 Best Practices dalla Community

### 1. Authentication Pattern
```typescript
onMounted(() => {
  // Dual fallback per Auth
  props.host.consumeContext(UMB_AUTH_CONTEXT, async (authContext: any) => {
    let token = await authContext?.getLatestToken();
    
    if (!token) {
      // Fallback localStorage
      const stored = localStorage.getItem("umb::auth::token");
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.accessToken;
      }
    }
    
    if (token) {
      // Usa il token
      await loadData(token);
    }
  });
});
```

### 2. Error Handling per API
```typescript
async function loadData(token: string) {
  try {
    const { data } = await tryExecute(
      props.host,
      umbHttpClient.get({
        url: "/api/endpoint",
        headers: { 'Authorization': `Bearer ${token}` }
      })
    );
    
    if (data) {
      // Successo
      items.value = data;
    }
  } catch (err) {
    console.error('[YourPlugin] API Error:', err);
    error.value = err?.message || 'Failed to load data';
  }
}
```

### 3. Styling con UUI CSS Variables
```vue
<style scoped>
.my-container {
  padding: var(--uui-size-space-4, 12px);
  background-color: var(--uui-color-surface, #fff);
  color: var(--uui-color-text, #1b264f);
  border-radius: var(--uui-border-radius, 6px);
  box-shadow: var(--uui-shadow-depth-1, 0 1px 3px rgba(0,0,0,0.12));
  font-family: var(--uui-font-family, sans-serif);
}

.my-button {
  background-color: var(--uui-color-selected, #3544b1);
  color: white;
  padding: var(--uui-size-space-3, 9px) var(--uui-size-space-4, 12px);
}
</style>
```

---

## ⚠️ Errori Comuni e Soluzioni

### Errore: "Value not persisting on save"
**Causa:** Manca `getValue()`
**Soluzione:** Aggiungi il metodo `getValue()` al Web Component

### Errore: "Cannot add property, object is not extensible"
**Causa:** Oggetto frozen da Umbraco
**Soluzione:** Clone nel setter con `structuredClone()`

### Errore: "Auth context not available"
**Causa:** `super.connectedCallback()` non chiamato
**Soluzione:** Chiama `super.connectedCallback()` PRIMA di tutto

### Errore: "consumeContext is not a function"
**Causa:** Non passi `host: this` a Vue
**Soluzione:** Passa `{ host: this, initialValue: this.value }`

### Errore: "uui-select not rendering properly"
**Causa:** Vite non riconosce tag custom
**Soluzione:** Aggiungi `isCustomElement` in vite.config.ts

---

## 📖 Risorse Ufficiali

- 📚 [Umbraco CMS Documentation](https://docs.umbraco.com/umbraco-cms)
- 🎨 [UUI Storybook](https://uui.umbraco.com/)
- 💬 [Umbraco Forum](https://forum.umbraco.com/)
- 🔧 [Umbraco UI GitHub](https://github.com/umbraco/Umbraco.UI)
- 📝 [Property Editor Tutorial](https://docs.umbraco.com/umbraco-cms/tutorials/creating-a-property-editor)

---

##  Checklist Finale

Prima di deployare il tuo Property Editor:

- [ ] `getValue()` implementato nel Web Component
- [ ] `UmbChangeEvent` usato (non `property-value-change`)
- [ ] `structuredClone()` per oggetti frozen
- [ ] `super.connectedCallback()` chiamato per primo
- [ ] Props `host` e `initialValue` passate a Vue
- [ ] Componenti UUI usati invece di HTML nativi
- [ ] `isCustomElement` configurato in Vite
- [ ] Umbraco packages in `external`
- [ ] Vue bundled (NON external)
- [ ] Flag `isUpdating` per evitare loop
- [ ] Error handling per API calls
- [ ] Fallback auth con localStorage
- [ ] CSS variables UUI per styling
- [ ] Testato save & publish in Umbraco

---

**Questa guida è stata compilata da ricerca approfondita su:**
- Documentazione ufficiale Umbraco 17
- Forum Umbraco (casi reali risolti)
- Best practices della community
- Codice sorgente Umbraco UI Library

**Mantieni questa guida aggiornata con le tue scoperte!** 🚀