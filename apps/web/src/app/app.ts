import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MapaComponent } from './features/mapa/mapa.component';

@Component({
  imports: [MapaComponent],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
