import { Email } from '../value-objects/email.vo';

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _email: Email,
    private readonly _name: string | null,
  ) {}

  static create(props: { id: string; email: Email; name?: string | null }) {
    return new User(props.id, props.email, props.name ?? null);
  }

  get id(): string {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get name(): string | null {
    return this._name;
  }

  toPrimitives() {
    return { id: this._id, email: this._email.value, name: this._name };
  }
}
