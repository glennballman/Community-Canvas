import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, User, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const confirmFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});

export type ConfirmFormData = z.infer<typeof confirmFormSchema>;

interface ConfirmFormProps {
  disabled?: boolean;
  onSubmit: (data: ConfirmFormData) => void;
  isSubmitting?: boolean;
}

export function ConfirmForm({ disabled, onSubmit, isSubmitting }: ConfirmFormProps) {
  const form = useForm<ConfirmFormData>({
    resolver: zodResolver(confirmFormSchema),
    defaultValues: {
      email: "",
      fullName: "",
      phone: "",
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  useEffect(() => {
    onSubmit(watchedValues);
  }, [watchedValues.email, watchedValues.fullName, watchedValues.phone, onSubmit]);

  return (
    <Form {...form}>
      <form 
        className="space-y-4"
        data-testid="confirm-form"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="your@email.com"
                  disabled={disabled || isSubmitting}
                  data-testid="confirm-email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Your name"
                  disabled={disabled || isSubmitting}
                  data-testid="confirm-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="tel"
                  placeholder="(555) 123-4567"
                  disabled={disabled || isSubmitting}
                  data-testid="confirm-phone"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export { confirmFormSchema };
