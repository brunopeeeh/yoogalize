// Nossa "Planilha Mágica" 🪄✨
// Aqui vivem todos os estabelecimentos incríveis que o Yoogalize conhece!

export type EstablishmentCategory = 
  | "Restaurante" 
  | "Pizzaria" 
  | "Hamburgeria" 
  | "Açaiteria" 
  | "Bar";

export type Establishment = {
  id: string;
  name: string;
  category: EstablishmentCategory;
  address: string;
  // Coordenadas mágicas para calcular distância
  latitude: number;
  longitude: number;
  // Informações extras que tornam cada lugar especial
  description?: string;
  rating?: number;
};

// Nossa coleção de lugares deliciosos! 🍕🍔🍰🍺
export const establishments: Establishment[] = [
  // Restaurantes
  {
    id: "1",
    name: "Restaurante Sabor da Terra",
    category: "Restaurante",
    address: "Rua das Flores, 45 - Centro",
    latitude: -23.550520,
    longitude: -46.633308,
    description: "Comida caseira com muito carinho",
    rating: 4.5,
  },
  {
    id: "2",
    name: "Cantina Italiana Nonna",
    category: "Restaurante",
    address: "Av. Paulista, 1234 - Bela Vista",
    latitude: -23.561684,
    longitude: -46.656139,
    description: "Tradição italiana no coração de SP",
    rating: 4.8,
  },
  {
    id: "3",
    name: "Sushi House Premium",
    category: "Restaurante",
    address: "Rua Augusta, 567 - Consolação",
    latitude: -23.556616,
    longitude: -46.662684,
    description: "Sushi fresco e autêntico",
    rating: 4.6,
  },
  
  // Pizzarias
  {
    id: "4",
    name: "Pizzaria Bella Napoli",
    category: "Pizzaria",
    address: "Rua Roma, 78 - Jardins",
    latitude: -23.568050,
    longitude: -46.672070,
    description: "Pizza napolitana de forno a lenha",
    rating: 4.7,
  },
  {
    id: "5",
    name: "Pizza & Cia",
    category: "Pizzaria",
    address: "Av. Brigadeiro Faria Lima, 2232 - Pinheiros",
    latitude: -23.577070,
    longitude: -46.687840,
    description: "Rodízio de pizzas artesanais",
    rating: 4.4,
  },
  
  // Hamburguerias
  {
    id: "6",
    name: "Burger & Co",
    category: "Hamburgeria",
    address: "Rua Oscar Freire, 901 - Pinheiros",
    latitude: -23.562570,
    longitude: -46.672250,
    description: "Hambúrgueres gourmet e artesanais",
    rating: 4.6,
  },
  {
    id: "7",
    name: "Smash Burger Station",
    category: "Hamburgeria",
    address: "Rua 13 de Maio, 1500 - Bela Vista",
    latitude: -23.554590,
    longitude: -46.640980,
    description: "Smash burgers e batatas rústicas",
    rating: 4.5,
  },
  {
    id: "8",
    name: "Classic Burger House",
    category: "Hamburgeria",
    address: "Av. Rebouças, 3970 - Pinheiros",
    latitude: -23.570790,
    longitude: -46.679520,
    description: "Burgers clássicos americanos",
    rating: 4.3,
  },
  
  // Açaiterias
  {
    id: "9",
    name: "Açaí do Norte",
    category: "Açaiteria",
    address: "Rua Haddock Lobo, 595 - Cerqueira César",
    latitude: -23.556020,
    longitude: -46.663890,
    description: "Açaí puro e cremoso direto do Pará",
    rating: 4.7,
  },
  {
    id: "10",
    name: "Tropical Bowl",
    category: "Açaiteria",
    address: "Rua da Consolação, 3012 - Consolação",
    latitude: -23.550960,
    longitude: -46.657700,
    description: "Bowls saudáveis e deliciosos",
    rating: 4.6,
  },
  
  // Bares
  {
    id: "11",
    name: "Bar do João",
    category: "Bar",
    address: "Rua Aspicuelta, 123 - Vila Madalena",
    latitude: -23.551680,
    longitude: -46.690420,
    description: "Boteco raiz com petiscos incríveis",
    rating: 4.5,
  },
  {
    id: "12",
    name: "Pub The Lion",
    category: "Bar",
    address: "Rua Augusta, 890 - Consolação",
    latitude: -23.554710,
    longitude: -46.660280,
    description: "Cervejas artesanais e rock'n roll",
    rating: 4.4,
  },
  {
    id: "13",
    name: "Boteco da Esquina",
    category: "Bar",
    address: "Rua Fradique Coutinho, 1340 - Pinheiros",
    latitude: -23.565230,
    longitude: -46.688970,
    description: "Chopp gelado e ambiente descontraído",
    rating: 4.6,
  },
  {
    id: "14",
    name: "Sky Bar Rooftop",
    category: "Bar",
    address: "Av. Paulista, 2000 - Bela Vista",
    latitude: -23.560910,
    longitude: -46.654870,
    description: "Vista panorâmica e drinks autorais",
    rating: 4.8,
  },
];

// Categorias disponíveis para filtro
export const categories: EstablishmentCategory[] = [
  "Restaurante",
  "Pizzaria",
  "Hamburgeria",
  "Açaiteria",
  "Bar",
];
