import { Resend } from 'resend';
import * as dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  console.log('Sending email...');
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'test@example.com', // random email to see what happens
    subject: 'Test Email',
    html: '<p>Testing Resend</p>'
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

test();
