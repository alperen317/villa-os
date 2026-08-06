import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InstallPrompt } from './core/pwa/install-prompt/install-prompt';

@Component({
  imports: [RouterModule, InstallPrompt],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
