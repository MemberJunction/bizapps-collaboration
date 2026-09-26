import { Routes } from '@angular/router';
import { Frame02Component } from './frames/frame-02.component';
import { Frame03Component } from './frames/frame-03.component';
import { Frame04Component } from './frames/frame-04.component';

export const routes: Routes = [
  { path: 'frame/02', component: Frame02Component },
  { path: 'frame/03', component: Frame03Component },
  { path: 'frame/04', component: Frame04Component },
  { path: '', redirectTo: 'frame/02', pathMatch: 'full' },
];
