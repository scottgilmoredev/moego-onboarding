declare module 'eslint-plugin-googleappsscript' {
  const plugin: {
    environments: {
      googleappsscript: {
        globals: Record<string, boolean>;
      };
    };
  };
  export default plugin;
}
