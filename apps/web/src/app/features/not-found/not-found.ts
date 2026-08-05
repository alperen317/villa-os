import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, NzButtonModule, NzIconModule],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
