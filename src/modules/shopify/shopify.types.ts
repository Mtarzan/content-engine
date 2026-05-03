export type ShopifyProduct = {
  id: number;
  title: string;
  body_html: string | null;
  variants: Array<{
    price: string;
  }>;
  images: Array<{
    src: string;
  }>;
};

export type ShopifyProductsResponse = {
  products: ShopifyProduct[];
};
