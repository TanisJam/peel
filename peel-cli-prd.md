# PRD — `peel`

> **Nombre del producto:** `peel`
> Doble lectura: pelar (peel) un cítrico, y "peel off" una rama para ver qué hay adentro. CLI standalone para levantar ramas en worktrees efímeros.

## 1. Problema

Cuando un dev está trabajando en una rama del proyecto y necesita levantar **otra** rama solamente para verificar funcionalidad (QA visual, revisar PR de un compañero, validar que un fix anda), tiene que:

1. Stashear o lidiar con los archivos modificados en su branch actual.
2. Cambiar de rama (perdiendo `node_modules` re-instalados, archivos generados, etc.) o clonar el repo en otro directorio.
3. Replicar el `.env` en el nuevo directorio.
4. Cambiar el puerto si tiene el original ocupado.
5. Correr el dev server.
6. Cuando termina, limpiar todo.

Es fricción pura para una tarea de 5 minutos.

## 2. Solución

Un CLI standalone, instalable vía `npm`/`npx`, que automatiza todo el flujo usando **git worktrees**: una sola línea levanta una instancia aislada de cualquier rama, con su propio `node_modules`, su `.env` copiado del worktree principal, en el puerto que el proyecto necesite, y se autodestruye al cerrar.

El comportamiento es **configurable por proyecto** mediante un archivo de config en el repo, generado por un wizard la primera vez (`peel init`).

## 3. Objetivos y no-objetivos

### Objetivos

- Cero fricción para levantar una rama distinta sin tocar el working directory actual.
- Project-agnostic: funciona en cualquier repo Node con `package.json` (o sin él, si las commands están configuradas).
- Configuración persistente y commiteable (un solo archivo en el repo).
- UX interactiva (fuzzy search, prompts amigables, spinners, colores) y modo no-interactivo (todo por flags) para scripting.
- Auto-cleanup robusto: el worktree se borra siempre al salir, salvo opt-out explícito.
- Mensajes de error útiles (qué proceso ocupa el puerto, qué falló en el install, etc.).

### No-objetivos

- No es un orquestador de servicios (Postgres, Redis, etc.). Asume que el usuario ya tiene esas dependencias corriendo en su entorno.
- No reemplaza Docker para entornos de prod-like aislados — es para verificación rápida.
- No maneja secretos: copia el `.env` del worktree principal tal cual.
- No corre tests, no abre PRs, no hace deploy. Solo levanta el server.
- No soporta Windows nativo en el MVP (sí WSL). macOS y Linux primero.

## 4. Usuarios target

Devs frontend/full-stack que trabajan en proyectos Node (Next.js, Vite, Express, NestJS, Remix, etc.) y necesitan probar ramas distintas frecuentemente. Asumimos que conocen git, npm/pnpm, y la terminal.

## 5. User stories

- **US-1.** Como dev, ejecuto `peel` sin argumentos, fuzzy-busco la rama, elijo `dev` o `build`, y se levanta. Cuando hago Ctrl+C, todo se limpia.
- **US-2.** Como dev, ejecuto `peel run feature/x dev` desde un script o alias, sin prompts.
- **US-3.** Como dev nuevo en un repo, ejecuto `peel init` y un wizard me pregunta puerto, env files, package manager, comandos, y guarda un config commiteable.
- **US-4.** Como dev, si el puerto está ocupado, el CLI me dice qué proceso lo tiene y me da el comando para matarlo, sin levantar nada.
- **US-5.** Como dev, paso `--keep` para que el worktree quede vivo y reutilizar el `node_modules` la próxima vez.
- **US-6.** Como dev, ejecuto `peel list` para ver qué worktrees creó la herramienta y `peel clean` para borrar uno o todos.

## 6. Requisitos funcionales

### 6.1 Comando `init`

- Detecta si ya existe config; si existe, pregunta antes de sobreescribir.
- Detecta automáticamente:
  - Package manager (presence de `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, default `npm`).
  - Comandos `dev`, `build`, `start` desde `package.json` `scripts`.
  - `.env` files presentes en el repo (`.env`, `.env.local`, `.env.development`).
- Wizard interactivo (`@clack/prompts`) que pregunta (ver "Nota sobre defaults" abajo):
  - **Modo de puerto**: `fixed` (entero), `auto-find` (toma el primer libre desde un base port).
  - **Puerto base** (default: 3000).
  - **Env files a copiar** (multi-select de los detectados; permite agregar custom).
  - **Package manager** (auto-detectado, confirmable).
  - **Comando install** (default basado en PM).
  - **Comando dev** (default desde `scripts.dev` con prefix del PM).
  - **Comando build** (idem).
  - **Comando start** (idem).
  - **Pre-run hooks** (lista opcional, ej: `pnpm prisma migrate dev`).
  - **Worktree base directory** (default: `..` relativo al repo).
  - **Auto-cleanup default** (`true`/`false`).
- Escribe el config en `.peel.yml` en la raíz del repo.
- Sugiere agregar el archivo al repo (NO al `.gitignore`).

### 6.2 Comando `run` (default)

Si se invoca sin args (`peel` solo o `peel run`), entra en flujo interactivo:

1. Lee config; si no existe, sugiere correr `init` y sale.
2. Hace `git fetch --prune` (con spinner).
3. Lista ramas (locales + `origin/*`, deduplicadas, ordenadas por `committerdate desc`).
4. Muestra fuzzy picker con preview del `git log -10` de cada rama.
5. Pregunta modo: `dev` o `build` (si solo hay uno configurado, lo asume).
6. Verifica puerto:
   - Si `portStrategy: fixed` y está ocupado → error con detalle del proceso, sale.
   - Si `portStrategy: auto-find` → busca el siguiente libre y lo informa.
7. Crea worktree en `<base>/<repoName>-<slug(branch)>`.
8. Copia env files configurados (solo si no existen ya en destino).
9. Corre install con spinner; si falla, muestra log y limpia worktree.
10. Corre pre-run hooks (si los hay); si alguno falla, limpia y sale.
11. Imprime banner con info: branch, path, mode, URL, política de cleanup.
12. Ejecuta el comando del modo elegido (heredando stdio).
13. Registra trap para SIGINT, SIGTERM y exit normal → limpia worktree salvo `--keep`.

#### Flags

- `--keep, -k` — no limpia el worktree al salir.
- `--mode <dev|build>` — fuerza modo, salta el prompt.
- `--port <n>` — overridea el puerto del config para esta corrida.
- `--no-fetch` — saltea el `git fetch` inicial.
- `--branch <name>, -b <name>` — pasa la branch sin prompt (alternativa al positional).
- `--yes, -y` — salta confirmaciones (asume default en cualquier prompt).

#### Argumentos posicionales

- `peel run [branch] [mode]` — branch y mode opcionales; si faltan, prompt.

### 6.3 Comando `list`

- Muestra todos los worktrees creados por la herramienta (filtrar por prefix configurado).
- Output en tabla: branch, path, age, status (running/idle).
- Detecta "running" buscando si el puerto base está ocupado por un proceso cuyo cwd está dentro del worktree (best-effort; si no se puede detectar, omite la columna status).

### 6.4 Comando `clean`

- `peel clean <branch>` — borra ese worktree.
- `peel clean --all` — borra todos los worktrees creados por la herramienta. Confirma antes.
- `peel clean --stale` — borra worktrees cuyas branches ya no existen ni local ni remoto.
- Usa `git worktree remove --force` por debajo.

### 6.5 Comando `config`

- `peel config show` — imprime el config actual en YAML.
- `peel config path` — imprime ruta absoluta del archivo de config.
- `peel config edit` — abre el archivo en `$EDITOR`.

## 7. Schema de configuración

Archivo: `.peel.yml` en la raíz del repo. Validado con `zod` o `valibot`.

```yaml
# Versión del schema; bumpear si rompemos compat
version: 1

port:
  base: 3000
  strategy: fixed   # 'fixed' | 'auto-find'

envFiles:
  - .env
  - .env.local

packageManager: pnpm   # 'npm' | 'pnpm' | 'yarn' | 'bun'

commands:
  install: pnpm install
  dev: pnpm dev
  build: pnpm build
  start: pnpm start

preRun: []   # ej: ['pnpm prisma generate', 'pnpm db:migrate']

worktree:
  baseDir: ..          # relativo al repo
  prefix: ''           # default: '<repoName>-'
  autoCleanup: true

git:
  fetchOnStart: true
  includeRemoteBranches: true
  excludeBranches: []  # patterns a ocultar del picker (ej: ['archive/*'])
```

Defaults razonables para cada campo. El `init` solo escribe lo que difiere del default para mantener el archivo limpio.

## 8. UX

### 8.1 Estilo visual

- Símbolos: `→` (info), `✓` (ok), `⚠` (warn), `✗` (error). Colores con `picocolors`.
- Spinner: braille (`⠋⠙⠹…`) o el built-in de `ora`.
- Bordes de prompts con `@clack/prompts` (look moderno tipo create-t3-app).
- Banner final con la info clave de la corrida.

### 8.2 Manejo de errores

Cada error debe contestar **qué pasó + qué hacer**. Ejemplos:

- **Puerto ocupado**:
  ```
  ✗ Port 3000 is in use by:
      next-server (PID 12345, started 2h ago)

    Free it with:  lsof -ti:3000 | xargs kill -9
    Or run with:   peel run --port 3001
  ```
- **Branch no existe**:
  ```
  ✗ Branch 'feature/x' not found locally or on origin.
    Did you mean: feature/y, feature/z?
  ```
- **Install falla**:
  ```
  ✗ Install failed (exit 1).
    Last 30 lines of log: ...
    Full log at: /tmp/peel-install-<timestamp>.log
  ```

## 9. Edge cases que el implementador debe cubrir

1. Branch con `/` en el nombre → slugify reemplazando `/` por `-`.
2. Worktree path ya existe pero para otra branch → error claro, sugerir `clean`.
3. Branch ya checkeada en otro worktree → git falla; capturar y dar mensaje.
4. Repo sin `.env` configurado → continuar sin copiar, warn.
5. `git fetch` falla (sin red) → warn, seguir con branches locales.
6. Ctrl+C **durante** install/build → cleanup completo, no dejar worktree zombie.
7. Cleanup falla (worktree con cambios no commiteados sin `--force`) → siempre usamos `--force`; si igual falla, mostrar comando manual.
8. `node_modules` muy pesado → ya está en `.gitignore`, no es problema; solo es lento. Spinner debe seguir vivo.
9. `auto-find` puerto: empezar en `base`, probar hasta `base+20`, después fallar.
10. `--keep` + worktree existente → reusar (no recrear, no reinstalar si `node_modules` está).
11. Worktree base dir no existe → crearlo o fallar con mensaje claro.
12. Repo no es git → error temprano.
13. Múltiples invocaciones simultáneas en la misma branch → segunda invocación detecta y aborta (lock file en el worktree, `peel.lock`).

## 10. Stack técnico

### Lenguaje y build

- **TypeScript** estricto.
- Build con **tsup** → ESM, target Node 20+.
- Distribución: paquete npm con `bin` en `package.json`.
- Shebang `#!/usr/bin/env node` en el entrypoint.

### Dependencias recomendadas

| Necesidad | Lib | Por qué |
|-----------|-----|---------|
| Parsing CLI | `commander` | Simple, maduro, suficiente para esta superficie |
| Prompts interactivos | `@clack/prompts` | UX moderna, fuzzy multi-select built-in, mantenida |
| Fuzzy filtering | `fuzzysort` | Rápido y simple, complementa los prompts |
| Spinners | `ora` o el de `@clack/prompts` | Si usás clack, reusá el de ahí |
| Colores | `picocolors` | Liviano, sin ANSI overhead |
| Subprocesos | `execa` | API mejor que `child_process`, soporta streams |
| Validación de config | `zod` | Errores claros, type inference |
| Lectura/escritura YAML | `yaml` | El más fiable |
| Detección de puerto libre | `get-port` | Para `auto-find` |
| Verificar puerto ocupado + proceso | `node:net` + parseo de `lsof`/`ss` | No hay lib decente cross-platform; wrapper propio |
| Detección de package manager | `@antfu/ni` o detección manual por lockfile | Manual es más simple |

### Estructura de archivos (sugerida)

```
src/
  index.ts              # entrypoint, configura commander
  commands/
    init.ts
    run.ts
    list.ts
    clean.ts
    config.ts
  core/
    config.ts           # load/save/validate
    worktree.ts         # git worktree wrappers
    port.ts             # check/find port
    process.ts          # spawn comandos con execa, manejo de stdio
    cleanup.ts          # trap handlers
    branches.ts         # listar/filtrar ramas
  ui/
    prompts.ts          # wrappers de clack
    banner.ts
    errors.ts           # mensajes de error formateados
  utils/
    slugify.ts
    paths.ts
test/
  ...
```

## 11. Testing

- **Unit tests** (vitest) para: config validation, slugify, port checker (con mocks de net), branch listing (con mocks de execa).
- **Integration tests**: crear un repo git temporal con `tmp-promise`, correr el binario contra él, verificar que crea/borra worktrees correctamente.
- **No** testear los prompts de clack — confiamos en la lib.
- Cobertura mínima objetivo: 70%.

## 12. Distribución

- Publicar en npm como `@<scope>/peel` o `peel` si está libre.
- README con: instalación (`npx`, `npm i -g`, `pnpm dlx`), quickstart (`peel init`, `peel`), ejemplo de config, troubleshooting.
- GIF de demo en el README mostrando el flujo interactivo.
- CI con GitHub Actions: lint + typecheck + tests + release con `changesets`.
- Versionado semver. Bump de `version` del schema = MAJOR.

## 13. Criterios de aceptación

El producto está terminado cuando:

- [ ] `npx peel init` corre el wizard y genera un config válido en cualquier proyecto Node.
- [ ] `peel` interactivo muestra fuzzy picker con preview, elige modo, levanta el server, y limpia al Ctrl+C.
- [ ] `peel run feature/x dev` no muestra ningún prompt y termina en server corriendo.
- [ ] Puerto ocupado siempre da el mensaje útil y nunca corrompe el worktree.
- [ ] `--keep` deja el worktree y la siguiente corrida con esa branch lo reusa sin reinstalar (si `node_modules` ya está).
- [ ] `peel list` y `peel clean --stale` funcionan en escenarios reales.
- [ ] El config es válido contra el schema; un campo inválido tira error legible al cargar.
- [ ] Tests pasan en CI en macOS y Linux con Node 20 y 22.
- [ ] README cubre instalación, init, uso básico y al menos 3 troubleshooting cases.

## 14. Fuera de alcance (futuro)

- Soporte Windows nativo.
- Integración con Docker (levantar Postgres/Redis junto al server).
- Hot-reload del config sin reiniciar.
- Hook system para correr scripts después del cleanup (ej: notificar Slack).
- TUI con dashboard para múltiples worktrees corriendo simultáneamente.
- Soporte para workspaces / monorepos con builds parciales.

## 15. Referencia rápida (cheatsheet del producto final)

```bash
peel init                          # configurar para este proyecto
peel                               # interactivo
peel run feature/x dev             # directo
peel run feature/x build --keep    # build mode, conservar worktree
peel list                          # ver worktrees activos
peel clean feature/x               # borrar uno
peel clean --stale                 # borrar los huérfanos
peel config show                   # ver config actual
```
