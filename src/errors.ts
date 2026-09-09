export class AibomError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AibomError";
    this.code = code;
  }
}
