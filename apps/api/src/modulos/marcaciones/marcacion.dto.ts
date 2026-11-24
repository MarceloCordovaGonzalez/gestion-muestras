import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Solicitud de marcación (Modelo de Arquitectura 9). */
export class CrearMarcacionDto {
  @ApiProperty({ description: 'UUID generado en el dispositivo (idempotencia, RF-08)' })
  @IsUUID('4')
  idvia: string;

  @ApiProperty({ example: '2026-09-30T12:02:25-03:00', description: 'Hora del dispositivo' })
  @IsISO8601({ strict: true })
  datevia: string;

  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lon: number;

  @ApiProperty({ description: 'Precisión GPS en metros (RF-09: solo registro en MVP1)' })
  @IsInt()
  @Min(0)
  @Max(100_000)
  precision: number;

  @ApiPropertyOptional({ description: 'MVP3. Se recibe y se ignora en MVP1.' })
  @IsOptional()
  @IsBoolean()
  ubicacionSimulada?: boolean;

  @ApiProperty({ enum: ['EN_LINEA', 'SIN_CONEXION'] })
  @IsIn(['EN_LINEA', 'SIN_CONEXION'])
  origen: 'EN_LINEA' | 'SIN_CONEXION';

  @ApiPropertyOptional() @IsOptional() @IsString() appVersion?: string;

  @ApiPropertyOptional({
    description: 'RN-07: el conductor confirma registrar un posible duplicado',
  })
  @IsOptional()
  @IsBoolean()
  confirmarDuplicado?: boolean;
}

/** Confirmación al conductor (RF-06, paso 10 del CU-02). */
export interface ConfirmacionMarcacion {
  idvia: string;
  fecha: string;
  hora: string;
  tipvia: 'R' | 'E' | null;
  estvia: 'CORRECTO' | 'ERROR';
  punto: { tipo: 'CENTRO' | 'LABORATORIO'; codigo: number; alias: string } | null;
  comuna: string;
  fueraDeRuta: boolean;
  distancia: number | null;
  moterr: string | null;
  puntoMasCercano: { alias: string; distancia: number } | null;
  /** true si la marcación ya existía (reenvío idempotente). */
  repetida: boolean;
}
