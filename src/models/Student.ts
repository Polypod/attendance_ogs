// src/models/Student.ts - Student Mongoose model
import { Schema, model, Document, Types } from 'mongoose';
import { Student, StudentStatusEnum } from '../types/interfaces';
import { ConfigService } from '../services/ConfigService';

interface IStudentDocument extends Omit<Student, '_id'>, Document {
  _id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

interface IEmergencyContact {
  name: string;
  phone: string;
}

const emergencyContactSchema = new Schema<IEmergencyContact>({
  name: { 
    type: String, 
    required: false
  },
  phone: { 
    type: String, 
    required: false
  }
}, { _id: false, timestamps: false });

const studentSchema = new Schema<IStudentDocument>({
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  categories: {
    type: [String],
    required: [true, 'At least one category is required'],
    validate: {
      validator: function(this: any, values: string[]) {
        if (!values || values.length === 0) return false;
        const configService = ConfigService.tryGetInitializedInstance();
        if (!configService) {
          return false;
        }
        return values.every(val => configService.isValidCategory(val));
      },
      message: function() {
        const configService = ConfigService.tryGetInitializedInstance();
        if (!configService) {
          return 'Configuration has not been initialized. Cannot validate student categories.';
        }
        const validCategories = configService.getCategoryValues().join(', ');
        return `Invalid student category. Must be one of: ${validCategories}`;
      }
    }
  },

  belt_level: {
    type: String,
    required: false,
    validate: {
      validator: function(value: string) {
        if (!value) return true;
        const configService = ConfigService.tryGetInitializedInstance();
        if (!configService) {
          return false;
        }
        return configService.isValidBeltLevel(value);
      },
      message: function() {
        const configService = ConfigService.tryGetInitializedInstance();
        if (!configService) {
          return 'Configuration has not been initialized. Cannot validate belt level.';
        }
        const validBeltLevels = configService.getBeltLevelValues().join(', ');
        return `Invalid belt level. Must be one of: ${validBeltLevels}`;
      }
    }
  },
  registration_date: { 
    type: Date, 
    default: () => new Date()
  },
  phone: { 
    type: String, 
    required: false
  },
  emergency_contact: { 
    type: emergencyContactSchema, 
    required: false
  },
  status: {
    type: String,
    enum: {
      values: Object.values(StudentStatusEnum),
      message: `Status must be one of: ${Object.values(StudentStatusEnum).join(', ')}`
    },
    default: StudentStatusEnum.ACTIVE
  },
  active: {
    type: Boolean,
    default: true,
    required: false
  },
  // Link back to the member register (OGS/PayloadCMS). Students without an
  // external_id were created locally and are never touched by the sync.
  external_source: {
    type: String,
    required: false,
    enum: {
      values: ['payload'],
      message: 'Unsupported external source: {VALUE}'
    }
  },
  external_id: {
    type: String,
    required: false
  },
  last_synced_at: {
    type: Date,
    required: false
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  versionKey: false
});

// Reporting pipelines often filter out inactive students after lookup.
// This compound index supports those filters when pushed down.
studentSchema.index({ active: 1, status: 1 });

// One student per member in the register. A partial index rather than a sparse
// one: sparse still indexes explicit nulls, so a second locally created student
// would collide with the first as soon as the field is written as null.
studentSchema.index(
  { external_id: 1 },
  { unique: true, partialFilterExpression: { external_id: { $type: 'string' } } }
);



export const StudentModel = model<IStudentDocument>('Student', studentSchema);