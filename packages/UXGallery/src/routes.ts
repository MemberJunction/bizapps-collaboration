import { Routes } from '@angular/router';
import { Frame02Component } from './frames/frame-02.component';

export const routes: Routes = [
  { path: 'frame/02', component: Frame02Component },
  { path: '', redirectTo: 'frame/02', pathMatch: 'full' },
];
