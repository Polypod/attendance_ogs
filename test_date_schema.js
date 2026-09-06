const Joi = require('joi');

const schema = Joi.object({
  date: Joi.date().required()
});

// Test with a past date
const pastDate = '2025-01-15';
const result = schema.validate({ date: pastDate });
console.log('Past date (string):', result);

// Test with ISO date string
const isoPastDate = '2025-01-15T00:00:00Z';
const result2 = schema.validate({ date: isoPastDate });
console.log('Past date (ISO):', result2);

// Test with Date object
const dateObj = new Date('2025-01-15');
const result3 = schema.validate({ date: dateObj });
console.log('Past date (Date object):', result3);
