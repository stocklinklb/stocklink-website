let categories = [];

export async function loadCategories() {
  try {
    const response = await fetch(`${API_ROOT}/categories`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Couldn't load categories");
    }

    const data = await response.json();

    categories = Array.isArray(data)
      ? data
      : data.categories ?? [];

    return categories;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export function getCategories() {
  return categories;
}