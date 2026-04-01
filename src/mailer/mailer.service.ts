import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AppMailerService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCode(
    email: string,
    code: string,
    firstName: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: `${code} es tu código de verificación - Baudex`,
      html: this.buildVerificationEmail(code, firstName),
    });
  }

  async sendPasswordResetCode(
    email: string,
    code: string,
    firstName: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: `${code} - Código para restablecer tu contraseña - Baudex`,
      html: this.buildPasswordResetEmail(code, firstName),
    });
  }

  private buildVerificationEmail(code: string, firstName: string): string {
    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Baudex</h1>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #555; font-size: 14px; margin: 0 0 24px;">Usa el siguiente código para verificar tu correo electrónico:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a237e;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px; margin: 0 0 4px;">Este código expira en <strong>10 minutos</strong>.</p>
          <p style="color: #888; font-size: 13px; margin: 0;">Si no solicitaste esto, puedes ignorar este correo.</p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Baudex. Todos los derechos reservados.</p>
        </div>
      </div>
    `;
  }

  private buildPasswordResetEmail(code: string, firstName: string): string {
    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #b71c1c 0%, #e53935 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Baudex</h1>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 8px;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #555; font-size: 14px; margin: 0 0 24px;">Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
          <div style="background: #fff3f3; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px; border: 1px solid #ffcdd2;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #b71c1c;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px; margin: 0 0 4px;">Este código expira en <strong>10 minutos</strong>.</p>
          <p style="color: #888; font-size: 13px; margin: 0;">Si no solicitaste restablecer tu contraseña, ignora este correo. Tu cuenta está segura.</p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Baudex. Todos los derechos reservados.</p>
        </div>
      </div>
    `;
  }
}
