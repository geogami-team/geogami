import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth-service.service';
import { Validators, FormBuilder } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {
  loginForm;
  error: string;
  register;
  codeInput = [];
  userEmail;
  

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public navCtrl: NavController,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Get user email address sent from forgot password page
    if(this.router.getCurrentNavigation().extras.state){
      this.userEmail = this.router.getCurrentNavigation().extras.state.email;
    }
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      password: ['', Validators.required],
      Input1: ['', Validators.required],
      Input2: ['', Validators.required],
      Input3: ['', Validators.required],
      Input4: ['', Validators.required],
      Input5: ['', Validators.required],
    });

    this.authService.setLoginPageOpen(false); // To hide error message from other pages

    this.authService.getErrorMessage().subscribe((e) => {
      this.error = e;
    });
  }

  resetPassword() {
    this.authService.resetPassword(this.loginForm.getRawValue().password, this.userEmail ,this.codeInput.join(''));
  }

  // Digits advance to the next box, Backspace jumps back — other keys
  // (shift, tab, paste shortcut, ...) don't move the focus around.
  onCodeKeyup(event: KeyboardEvent, nextElement, prevElement?) {
    if (event.key >= '0' && event.key <= '9') {
      if (nextElement) {
        nextElement.setFocus();
      }
    } else if (event.key === 'Backspace' && prevElement) {
      prevElement.setFocus();
    }
  }

  // Let the user paste the whole verification code into any of the boxes:
  // distribute the digits over all five fields and jump to the password
  // input once the code is complete.
  handleCodePaste(event: ClipboardEvent, passwordField) {
    event.preventDefault();
    const text = event.clipboardData ? event.clipboardData.getData('text') : '';
    const digits = (text || '').replace(/\D/g, '').slice(0, 5).split('');
    if (digits.length === 0) {
      return;
    }

    const patch = {};
    for (let i = 0; i < 5; i++) {
      this.codeInput[i] = digits[i] || '';
      patch['Input' + (i + 1)] = digits[i] || '';
    }
    this.loginForm.patchValue(patch);

    if (digits.length === 5 && passwordField) {
      setTimeout(() => passwordField.setFocus(), 0);
    }
  }

}
