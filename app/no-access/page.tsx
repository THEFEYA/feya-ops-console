import { ShieldOff } from 'lucide-react'

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-4">
        <div className="flex justify-center">
          <div className="relative">
            <ShieldOff className="w-20 h-20 text-neon-red" />
            <div
              className="absolute inset-0 blur-xl opacity-40"
              style={{ background: '#ff3355' }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold neon-text-red">Нет доступа</h1>
          <p className="text-muted-foreground text-lg">
            Токен отсутствует или недействителен.
          </p>
        </div>

        <div className="glass-card rounded-xl p-5 text-sm text-muted-foreground text-left space-y-2">
          <p className="font-medium text-foreground">Как получить доступ:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Добавьте токен к URL: <code className="text-neon-cyan">?t=ВАШ_ТОКЕН</code></li>
            <li>Токен задаётся в переменной <code className="text-neon-cyan">FEYA_DASH_TOKEN</code></li>
            <li>Обратитесь к администратору системы</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          FEYA Ops Console · Доступ ограничен
        </p>
      </div>
    </div>
  )
}
