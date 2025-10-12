# Painel de Descoberta Local - Yoggalize

Este é um painel interativo desenvolvido para ajudar usuários a descobrir estabelecimentos comerciais locais com base em sua localização. A aplicação permite a busca e filtragem de lojas, restaurantes e outros serviços de forma rápida e intuitiva.

## ✨ Funcionalidades Principais

- **Detecção de Localização**: O usuário pode optar por usar sua localização atual, detectada pelo navegador com alta precisão, ou digitar um endereço manualmente.
- **Geocodificação Reversa**: Converte as coordenadas de latitude e longitude do usuário em um endereço legível para fácil verificação.
- **Edição de Endereço com Autocompletar**: Permite que o usuário edite o endereço diretamente na página de busca, com sugestões de autocompletar para facilitar a digitação.
- **Filtragem Dinâmica**: Os resultados podem ser filtrados em tempo real por:
  - **Cidade**: Um menu suspenso com as cidades disponíveis.
  - **Categoria**: Checkboxes para selecionar um ou mais tipos de estabelecimento (ex: Restaurante, Padaria, etc.).
  - **Raio de Distância**: Um controle deslizante para ajustar a distância da busca.
- **Resultados Ordenados**: As lojas encontradas são sempre exibidas da mais próxima para a mais distante.
- **Interface Responsiva e Intuitiva**: A barra de filtros permanece fixa na lateral durante a rolagem, melhorando a usabilidade em telas maiores.

## 🚀 Tecnologias Utilizadas

- **Framework**: React com Vite e TypeScript
- **Estilização**: Tailwind CSS e shadcn/ui para os componentes.
- **Roteamento**: React Router
- **APIs de Geolocalização**: 
  - **Geolocation API** do navegador para obter as coordenadas do usuário.
  - **Nominatim (OpenStreetMap)** para geocodificação reversa (coordenadas -> endereço) e para o autocompletar de endereços.
- **Publicação (Deploy)**: Configurado para deploy na Vercel.

## Local (Desenvolvimento)

Siga os passos abaixo para executar o projeto em sua máquina local.

### Pré-requisitos

- [Node.js](https://nodejs.org/en) (versão 18 ou superior)
- [Bun](https://bun.sh/) (gerenciador de pacotes)

### Instalação

1. Clone o repositório para sua máquina:
   ```bash
   git clone https://github.com/seu-usuario/seu-repositorio.git
   ```

2. Navegue até a pasta do projeto:
   ```bash
   cd seu-repositorio
   ```

3. Instale as dependências do projeto:
   ```bash
   bun install
   ```

### Executando o Projeto

Com as dependências instaladas, inicie o servidor de desenvolvimento:

```bash
  bun run dev
```

O projeto estará disponível em `http://localhost:5173` (ou outra porta, se a 5173 estiver em uso).

## ☁️ Publicação (Deploy)

O projeto está configurado para deploy contínuo na [Vercel](https://vercel.com). Para publicar, basta conectar seu repositório Git à Vercel. O arquivo `vercel.json` já está configurado para garantir que o build e as rotas da aplicação funcionem corretamente.# yoogalize
