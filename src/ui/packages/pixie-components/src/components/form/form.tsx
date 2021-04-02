// This component renders a form from a JSON object. Useful for Username and Password Authentication.
import * as React from 'react';
import {
  Button,
  createStyles,
  Theme,
  withStyles,
  WithStyles,
  TextField,
} from '@material-ui/core';
import { PixienautBox, PixienautImage } from 'components/auth/pixienaut-box';

const styles = ({ spacing, typography }: Theme) => createStyles({
  button: {
    marginTop: spacing(2),
    paddingTop: spacing(1),
    paddingBottom: spacing(1),
    textTransform: 'uppercase',
  },
  formField: {
    display: 'block',
  },
  inputLabel: {
    textTransform: 'capitalize',
  },
  errorField: {
    color: 'red',
    fontSize: typography.fontSize,
    fontFamily: typography.fontFamily,
  },
});

/**
 * Represents a message that should be shown above a field.
 * Modified from ory/kratos-client.
 */
export interface FormFieldMessage {
  // The context object of the message.
  context?: object;
  // The text of the actual message.
  text?: string;
}

/**
 * Field represents a HTML Form Field.
 * Modified from ory/kratos-client.
 */
export interface FormField {
  // Disabled is the equivalent of `<input {{if .Disabled}}disabled{{end}}\">`
  disabled?: boolean;
  // The messages for this particular input. Might include a description of failures if any occur.
  messages?: Array<FormFieldMessage>;
  //  Name is the equivalent of `<input name=\"{{.Name}}\">`
  name: string;
  // Pattern is the equivalent of `<input pattern=\"{{.Pattern}}\">`
  pattern?: string;
  // Required is the equivalent of `<input required=\"{{.Required}}\">`
  required?: boolean;
  // Type is the equivalent of `<input type=\"{{.Type}}\">`
  type: string;
  // Value is the equivalent of `<input value=\"{{.Value}}\">`
  value?: object;
}

/**
 * FormStructure represents the full form to be rendered.
 */
export interface FormStructure {
  // The Text to render on the submit button.
  submitBtnText: string;
  // Action should be used as the form action URL `<form action=\"{{ .Action }}\" method=\"post\">`.
  action: string;
  // Form contains multiple fields
  fields: Array<FormField>;
  // Method is the REST method for the form(e.g. POST)
  method: string;
  // Messages that come up when submitting.
  errors?: Array<FormFieldMessage>;
  // Event to happen when the user submits the form. If `defaultSubmit` is false
  // or unspecified, onClick will be run. If 'defaultSubmit` is true, then we'll
  // run onClick and also submit the form.
  onClick?: () => void;
  // onChange will receive data from a formField whenever that data is updated.
  onChange?: (f: any) => any;
  // Submit the form when click submit. If unspecified, the form will not submit.
  defaultSubmit?: boolean;
}

export const composeMessages = (messages?: Array<FormFieldMessage>): string | null => {
  if (!messages) {
    return null;
  }
  return messages.map((m) => m.text).join('\n');
};

interface FormFieldProps extends WithStyles<typeof styles>, FormField {
  onChange?: (e: any) => void;
}

const FormField = (props: FormFieldProps) => {
  const { onChange } = props;
  const field = props as FormField;
  // TODO(philkuz) figure out how to keep the value set OR wipe the value away beforehand to avoid this.
  // If the value is set beforehand, you can't edit the field.
  const isHidden = field.type === 'hidden';
  const value = field.value && isHidden ? { value: field.value } : {};
  return (
    <TextField
      className={props.classes.formField}
      label={isHidden ? null : field.name}
      InputLabelProps={{ className: props.classes.inputLabel }}
      name={field.name}
      onChange={onChange}
      disabled={field.disabled}
      required={field.required}
      helperText={composeMessages(field.messages)}
      type={field.type}
      {...value}
    />
  );
};

export interface FormProps extends WithStyles<typeof styles>, FormStructure {

}

export const Form = withStyles(styles)((props: FormProps) => {
  const {
    submitBtnText,
    action,
    fields,
    method,
    classes,
    onClick,
    onChange,
    defaultSubmit,
    errors,
  } = props;

  const onSubmit = (e) => {
    if (onClick != null) {
      onClick();
    }
    if (defaultSubmit == null || !defaultSubmit) {
      e.preventDefault();
    }
  };

  const errorText = composeMessages(errors);

  return (
    <>
      {errorText && (
        <div className={classes.errorField}>
          {' '}
          {errorText}
        </div>
      )}

      <form method={method} action={action} onSubmit={onSubmit}>
        {fields.map((f) => (
          <FormField
            key={f.name}
            classes={classes}
            onChange={onChange}
            {...f}
          />
        ))}

        <Button
          // Note we don't specify onClick, instead call onSubmit.
          className={classes.button}
          variant='contained'
          type='submit'
          color='primary'
        >
          {submitBtnText}
        </Button>
      </form>
    </>
  );
});

export interface PixienautFormProps extends WithStyles<typeof styles> {
  // The internal form that we should render.
  formProps: FormStructure;
}

export const PixienautForm = withStyles(styles)(({ classes, formProps }: PixienautFormProps) => {
  const hasError = formProps.errors != null;
  const image: PixienautImage = hasError ? 'octopus' : 'balloon';

  return (
    <PixienautBox image={image}>
      <Form classes={classes} {...formProps} />
    </PixienautBox>
  );
});