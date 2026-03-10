// Ambient type stub for the 'postgres' npm package.
// Required because tsgo (the TypeScript Go checker used in type-check script)
// does not honour the "admin-system" entry in tsconfig.json's "exclude" array,
// causing it to type-check admin-system/server files which import 'postgres'.
// The stub only activates when no real types can be resolved for the package.
declare module 'postgres' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function postgres(connectionString: string, options?: Record<string, unknown>): any;
  export default postgres;
}
