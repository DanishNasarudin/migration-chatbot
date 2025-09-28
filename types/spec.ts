export type FieldSpec = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "datetime";
  nullable?: boolean;
  unit?: string;
  enumVals?: string[];
  regex?: string;
  isPrimary?: boolean;
  description?: string;
};

export type SpecDoc = {
  name: string;
  version: string;
  domain?: "finance" | "healthcare" | "ecommerce" | "generic";
  fields: FieldSpec[];
  keys?: {
    primary?: string[]; // composite PK support
    unique?: string[][]; // one or more unique constraints
  };
  relations?: Array<{
    from: string; // local field
    toSpec: string; // target spec name/version
    toField: string;
    onDelete?: "cascade" | "restrict" | "set_null";
  }>;
  examples?: Record<string, unknown>[]; // small example rows
  notes?: string;
};
