import { Role } from '../enums/role.enum';

export class AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
