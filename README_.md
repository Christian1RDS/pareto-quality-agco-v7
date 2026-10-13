# PARETO QUALITY AGCO V7.0

Migração da base V6.5 para React + Vite, preservando filtros, RFT, Pareto de anomalias, Pareto por WOs e tabela de máquinas.

## Estrutura e renomeação
Os arquivos foram entregues com `_V7.0` para controle de versão. Ao montar o repositório, renomeie e mova:

- `package_V7.0.json` → `package.json`
- `vite.config_V7.0.js` → `vite.config.js`
- `postcss.config_V7.0.js` → `postcss.config.js`
- `tailwind.config_V7.0.js` → `tailwind.config.js`
- `index_V7.0.html` → `index.html`
- `main_V7.0.jsx` → `src/main.jsx`
- `App_V7.0.jsx` → `src/App.jsx`
- `index_V7.0.css` → `src/index.css`
- componentes → `src/components/`, removendo `_V7.0`
- utilitários → `src/utils/`, removendo `_V7.0`
- `deploy_V7.0.yml` → `.github/workflows/deploy.yml`
- `gitignore_V7.0.txt` → `.gitignore`

## Execução
```bash
npm install
npm run dev
```

## Validação de produção
```bash
npm run build
npm run preview
```

## GitHub Pages
Em Settings → Pages, selecione **GitHub Actions**. O `base: "./"` foi usado para manter os recursos portáveis em GitHub Pages e facilitar o futuro carregamento de modelos em `public/models/`.

## Próxima etapa
Adicionar `public/models/cabine-vtba.glb` e o componente `Viewer3D.jsx` após validar esta base funcional.
