# Yoogalize Painel

![Yoogalize Logo](public/yoogalize.png) <!-- Se tiver um logo, ajuste o caminho -->

Um painel administrativo e aplicativo de busca para o Yoogalize, focado em ajudar usuários a descobrir os melhores estabelecimentos próximos e fornecer ferramentas de gerenciamento.

## 🚀 Visão Geral

Este projeto é a interface principal para o Yoogalize, permitindo que os usuários:
- Encontrem estabelecimentos próximos usando sua localização atual ou um endereço/CEP.
- Visualizem detalhes dos estabelecimentos.
- (Adicione outras funcionalidades chave aqui, ex: gerenciem favoritos, etc.)

## ✨ Funcionalidades

- Busca de estabelecimentos por localização (geolocalização ou entrada manual).
- Sugestões de endereço com base na digitação (Mapbox Geocoding).
- (Liste outras funcionalidades importantes aqui, ex: visualização de horários de funcionamento, cards de resultados, etc.)

## 🛠️ Tecnologias Utilizadas

Este projeto foi desenvolvido com as seguintes tecnologias:

-   **Frontend:**
    -   [React](https://react.dev/) (Biblioteca JavaScript para construção de interfaces de usuário)
    -   [TypeScript](https://www.typescriptlang.org/) (Superset tipado de JavaScript)
    -   [Vite](https://vitejs.dev/) (Ferramenta de build rápido)
    -   [Tailwind CSS](https://tailwindcss.com/) (Framework CSS utilitário)
    -   [Shadcn/ui](https://ui.shadcn.com/) (Componentes de UI construídos com Tailwind CSS e Radix UI)
    -   [React Router DOM](https://reactrouter.com/en/main) (Para roteamento na aplicação)
    -   [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/) (Para geocodificação e mapas)
    -   [Sonner](https://sonner.emilkowal.ski/) (Para notificações toast)
-   **Ferramentas de Desenvolvimento:**
    -   [ESLint](https://eslint.org/) (Para análise estática de código)
    -   [Prettier](https://prettier.io/) (Para formatação de código)
    -   [Vitest](https://vitest.dev/) (Framework de testes)

## ⚙️ Pré-requisitos

Antes de começar, certifique-se de ter as seguintes ferramentas instaladas:

-   [Node.js](https://nodejs.org/en/) (versão 18 ou superior)
-   [npm](https://www.npmjs.com/) (gerenciador de pacotes do Node.js) ou [Bun](https://bun.sh/) (se estiver usando Bun)

## 🚀 Como Configurar e Rodar o Projeto

Siga os passos abaixo para configurar e executar o projeto em sua máquina local.

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/yoggalize_painel.git # Substitua pelo seu repositório
cd yoggalize_painel
```

### 2. Instalar Dependências

Usando npm:
```bash
npm install
```
Ou usando Bun:
```bash
bun install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto, baseado no `.env.example`, e preencha com suas chaves:

```
VITE_MAPBOX_ACCESS_TOKEN=sua_chave_de_acesso_mapbox
# Adicione outras variáveis de ambiente aqui, se houver
```
**Importante:** Não compartilhe seu arquivo `.env` publicamente.

### 4. Rodar o Servidor de Desenvolvimento

Usando npm:
```bash
npm run dev
```
Ou usando Bun:
```bash
bun dev
```

O aplicativo estará disponível em `http://localhost:5173` (ou outra porta, conforme indicado no terminal).

### 5. Construir para Produção

Usando npm:
```bash
npm run build
```
Ou usando Bun:
```bash
bun build
```
Os arquivos de produção serão gerados na pasta `dist/`.

## 🧪 Testes

Para rodar os testes do projeto:

Usando npm:
```bash
npm test
```
Ou usando Bun:
```bash
bun test
```

## 📁 Estrutura do Projeto

```
.
├── public/                 # Arquivos estáticos (imagens, favicon)
├── src/                    # Código fonte da aplicação
│   ├── App.tsx             # Componente principal da aplicação
│   ├── main.tsx            # Ponto de entrada da aplicação
│   ├── assets/             # Ativos como imagens, ícones (se houver)
│   ├── components/         # Componentes reutilizáveis
│   │   ├── ui/             # Componentes de UI do Shadcn/ui
│   │   └── ...             # Outros componentes específicos da aplicação
│   ├── data/               # Dados mockados ou configurações (ex: estabelecimentos.ts)
│   ├── hooks/              # Hooks React personalizados
│   ├── lib/                # Funções utilitárias e lógicas de negócio
│   ├── pages/              # Páginas/Rotas da aplicação
│   └── styles/             # Arquivos de estilo globais (index.css, App.css)
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore              # Arquivos e pastas a serem ignorados pelo Git
├── package.json            # Metadados do projeto e dependências
├── tsconfig.json           # Configurações do TypeScript
├── postcss.config.js       # Configurações do PostCSS
├── tailwind.config.ts      # Configurações do Tailwind CSS
├── vite.config.ts          # Configurações do Vite
└── ...                     # Outros arquivos de configuração
```

## 🤝 Como Contribuir

Agradecemos o seu interesse em contribuir! Siga estas diretrizes:

1.  Faça um fork do repositório.
2.  Crie uma nova branch para sua feature (`git checkout -b feature/minha-nova-feature`).
3.  Faça suas alterações e certifique-se de que os testes passem.
4.  Commit suas mudanças (`git commit -m 'feat: Adiciona nova feature X'`).
5.  Envie para a branch original (`git push origin feature/minha-nova-feature`).
6.  Abra um Pull Request descrevendo suas alterações.

### Padrões de Código

-   Utilizamos ESLint e Prettier para manter a consistência do código. Certifique-se de rodar `npm run lint` e `npm run format` antes de commitar.
-   Siga as convenções de nomenclatura e estrutura de arquivos existentes.

## 📄 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes. <!-- Se você tiver um arquivo LICENSE -->

## 📞 Contato

Se tiver alguma dúvida ou sugestão, sinta-se à vontade para entrar em contato.