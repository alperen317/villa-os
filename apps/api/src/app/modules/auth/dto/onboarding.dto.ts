import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class OnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
