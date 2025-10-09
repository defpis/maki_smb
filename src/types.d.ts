declare module "des.js" {
  export const DES: {
    create(opts: { type: "encrypt" | "decrypt"; key: Buffer }): {
      update(data: Buffer): number[];
    };
  };
}

declare module "js-md4" {
  export function arrayBuffer(input: Buffer): ArrayBuffer;
}
