import {createApp} from '../proxy';

export class ServeCommand {
  async run() {
    const app = createApp();
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`App listening on port ${PORT}`);
      console.log('Press Ctrl+C to quit.');
    });
  }
}
