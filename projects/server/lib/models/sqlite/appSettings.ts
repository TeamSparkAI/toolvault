import { AppSettingsModel } from '../appSettings';
import { SettingsModel } from './settings';

export class SqliteAppSettingsModel extends AppSettingsModel {
    constructor(settings: SettingsModel) {
        super(settings);
    }
}
