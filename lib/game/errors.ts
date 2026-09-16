export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class NotFoundError extends GameError {
  constructor(message = "Introuvable") {
    super(message, 404);
  }
}

export class UnauthorizedError extends GameError {
  constructor(message = "Non autorisé") {
    super(message, 401);
  }
}
