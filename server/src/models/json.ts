export const idJson = {
  toJSON: {
    transform: (_d: unknown, r: Record<string, unknown>) => {
      r.id = String(r._id);
      delete r._id;
      delete r.__v;
      return r;
    },
  },
};
