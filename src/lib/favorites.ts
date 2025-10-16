const FAVORITES_KEY = 'yoggalize_favorites';

/**
 * Busca a lista de IDs de estabelecimentos favoritos do localStorage.
 * @returns Um array de strings com os IDs.
 */
export const getFavoriteIds = (): string[] => {
  try {
    const item = window.localStorage.getItem(FAVORITES_KEY);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    console.error("Erro ao ler favoritos do localStorage:", error);
    return [];
  }
};

/**
 * Salva a lista completa de IDs de favoritos no localStorage.
 * @param ids O array de IDs a ser salvo.
 */
const saveFavoriteIds = (ids: string[]) => {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error("Erro ao salvar favoritos no localStorage:", error);
  }
};

/**
 * Adiciona um ID de estabelecimento à lista de favoritos.
 * @param id O ID a ser adicionado.
 */
export const addFavoriteId = (id: string) => {
  const currentIds = getFavoriteIds();
  if (!currentIds.includes(id)) {
    saveFavoriteIds([...currentIds, id]);
  }
};

/**
 * Remove um ID de estabelecimento da lista de favoritos.
 * @param id O ID a ser removido.
 */
export const removeFavoriteId = (id: string) => {
  const currentIds = getFavoriteIds();
  const newIds = currentIds.filter(favId => favId !== id);
  saveFavoriteIds(newIds);
};
