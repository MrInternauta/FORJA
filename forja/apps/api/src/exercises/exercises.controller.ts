import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CreateExerciseSchema, ExerciseFiltersSchema } from "@forja/shared";
import { Roles } from "../auth/roles.decorator";
import { zodParse } from "../common/zod";
import { ExercisesService } from "./exercises.service";

@Controller("exercises")
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.exercises.list(zodParse(ExerciseFiltersSchema, query));
  }

  @Get(":id")
  byId(@Param("id", ParseUUIDPipe) id: string) {
    return this.exercises.byId(id);
  }

  @Post()
  @Roles("ADMIN")
  create(@Body() body: unknown) {
    return this.exercises.create(zodParse(CreateExerciseSchema, body));
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.exercises.softDelete(id);
  }
}
