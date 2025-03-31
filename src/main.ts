import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import * as bodyParser from 'body-parser';
import { ADMINAUTO } from './core/data';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Active la validation globale des DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.use(bodyParser.json({ limit: '10mb' })); // Augmente la limite à 10MB
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  // Activer CORS pour tous les domaines (vous pouvez ajuster cela selon vos besoins)
  app.enableCors({
    origin: 'http://localhost:3000',  // URL du frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization', // Autoriser le header Authorization
    credentials: true
  });
  await ADMINAUTO();
  await app.listen(5000);  // Le backend écoute sur le port 5000
}

bootstrap();
