import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth-service.service';
import { Validators, FormBuilder } from '@angular/forms';
import { LanguageService } from 'src/app/services/language.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  loginForm;
  error: string;
  loading;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });

    this.authService.setLoginPageOpen(false); // To hide error message from other pages

    this.authService.getErrorMessage().subscribe((e) => {
      this.error = e;
    });

    this.authService.getLoading().subscribe((loading) => {
      this.loading = loading;
    });
  }

  login() {
    // Store the app language active at registration as the account's
    // default language.
    this.authService.register({
      ...this.loginForm.getRawValue(),
      language: this.languageService.selected || 'de',
    });
  }
}
