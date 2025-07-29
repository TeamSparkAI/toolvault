import { HostModel } from '../host';
import { SettingsModel as SqliteSettingsModel } from './settings';

export class SqliteHostModel extends HostModel {
    constructor(settings: SqliteSettingsModel) {
        super(settings);
    }
} 