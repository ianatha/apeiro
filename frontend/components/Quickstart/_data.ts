export const colorFilter = {
  defaultValue: "black",
  options: [
    { label: "Black", value: "black" },
    { label: "Tomato", value: "tomato" },
    { label: "Blueish", value: "#272458" },
    { label: "Beige", value: "#BFB8A5" },
  ],
};

export const sizeFilter = {
  defaultValue: "36",
  options: [
    { label: "32mm", value: "32" },
    { label: "36mm", value: "36" },
    { label: "40mm", value: "40" },
  ],
};

export const priceFilter = {
  formatOptions: {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  },
  defaultValue: [800, 2000],
  min: 500,
  max: 4000,
};

export const filterTags = ["Mens", "40mm", "$0-$200", "Black"];

export const blueFilters = {
  defaultValue: ["casio", "fossil"],
  options: [
    { label: "Casio", value: "casio", count: 18 },
    { label: "Fossil", value: "fossil", count: 6 },
    { label: "Tommy Hilfiger", value: "tommy-hilfiger", count: 9 },
    { label: "Puma", value: "puma", count: 3 },
    { label: "Reebok", value: "reebok", count: 2 },
    { label: "Nike", value: "nike", count: 1 },
  ],
};

export const breadcrumbData = [
  { label: "Home", slug: "/" },
  {
    label: "Watches",
    slug: "watches",
  },
  {
    label: "Mens Watches",
    slug: "watches/mens-watches",
  },
];
