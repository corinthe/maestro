export class MaestroError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {},
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
