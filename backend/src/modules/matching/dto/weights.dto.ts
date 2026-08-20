import { IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const WEIGHT_FACTORS = [
  'skills', 'experience', 'location', 'salary', 'culture', 'availability',
] as const;

export type WeightFactor = (typeof WEIGHT_FACTORS)[number];

export type MatchWeights = Record<WeightFactor, number>;

/** The shipped defaults, expressed as shares of 100. */
export const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 35,
  experience: 20,
  location: 15,
  salary: 15,
  culture: 10,
  availability: 5,
};

/**
 * Weights are relative, not required to total 100 — the service normalises them
 * before scoring. Each is capped at 100 so one factor cannot silently dwarf the
 * rest through a runaway value.
 */
export class UpdateWeightsDto {
  @ApiProperty({ minimum: 0, maximum: 100, example: 35 })
  @IsNumber() @Min(0) @Max(100) skills: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 20 })
  @IsNumber() @Min(0) @Max(100) experience: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 15 })
  @IsNumber() @Min(0) @Max(100) location: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 15 })
  @IsNumber() @Min(0) @Max(100) salary: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 10 })
  @IsNumber() @Min(0) @Max(100) culture: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 5 })
  @IsNumber() @Min(0) @Max(100) availability: number;
}
