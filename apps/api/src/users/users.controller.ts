import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { createUserSchema, updateUserStatusSchema, type CreateUserInput, type UpdateUserStatusInput } from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AdminGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  list(@Auth() auth: AuthContext) {
    return this.usersService.list(auth);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ) {
    return this.usersService.create(auth, body);
  }

  @Patch(":id/status")
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
  ) {
    return this.usersService.updateStatus(auth, id, body);
  }
}
